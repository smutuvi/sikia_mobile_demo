import React, {useState, useCallback, useEffect} from 'react';
import {View, ScrollView, TextInput} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, IconButton, SegmentedButtons, Button} from 'react-native-paper';
import {observer} from 'mobx-react-lite';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {useWhisperVoiceInput} from '../../hooks/useWhisperVoiceInput';
import {isOnlineSttConfigured} from '../../services/onlineSttService';
import {transcribeWavFile, isWhisperLoaded, warmUpAsrModel} from '../../services/whisperVoiceService';
import {asrModelStore} from '../../store';
import type {SttMode} from '../../hooks/useWhisperVoiceInput';

/** Sample WAV URL (same as whisper-cpp-test) for "Transcribe sample file" */
const JFK_SAMPLE_WAV_URL = 'https://github.com/ggerganov/whisper.cpp/raw/master/samples/jfk.wav';

export const WhisperTestScreen: React.FC = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [transcript, setTranscript] = useState('');
  const [sttMode, setSttMode] = useState<SttMode>('online');
  const [sampleTranscribing, setSampleTranscribing] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [sampleChunk, setSampleChunk] = useState<number | null>(null);

  const onResult = useCallback(
    (text: string) => {
      if (!text) {
        return;
      }
      setTranscript(prev => (prev ? `${prev} ${text}` : text));
      if (sttMode === 'live') {
        setLiveTranscript(text);
      }
    },
    [sttMode],
  );

  const {
    isRecording,
    isTranscribing,
    error,
    onlineStep,
    start: startVoice,
    stop: stopVoice,
    reset: resetVoice,
  } = useWhisperVoiceInput({onResult, mode: sttMode});

  const activeAsrModel = asrModelStore.activeModel;
  const hasOfflineModel = Boolean(activeAsrModel?.isDownloaded);
  const isOnline = sttMode === 'online';
  const isLiveOffline = sttMode === 'live';
  const isConfigured = isOnline
    ? isOnlineSttConfigured()
    : hasOfflineModel;
  const statusLabel = isTranscribing
    ? onlineStep ||
      (isRecording
        ? isLiveOffline
          ? 'Streaming…'
          : 'Transcribing…'
        : 'Processing… (offline)')
    : isRecording
      ? isLiveOffline
        ? 'Listening (live)… tap mic to stop'
        : 'Listening… (tap mic again to stop)'
      : '';
  const whisperLoaded = isWhisperLoaded();

  useEffect(() => {
    if (hasOfflineModel && !whisperLoaded) {
      warmUpAsrModel().catch(() => {
        // Non-fatal: fall back to lazy initialization on first use
      });
    }
  }, [hasOfflineModel, whisperLoaded]);

  const handleMicPress = () => {
    if (isRecording || isTranscribing) {
      stopVoice();
    } else {
      // When starting a new recording, clear any existing transcript text
      setTranscript('');
      setLiveTranscript('');
      setSampleError(null);
      setSampleChunk(null);
      startVoice();
    }
  };

  const handleTranscribeSample = useCallback(async () => {
    if (!hasOfflineModel || sampleTranscribing) return;
    setSampleError(null);
    setSampleTranscribing(true);
    setSampleChunk(null);
    const destPath = `${RNFS.CachesDirectoryPath}/jfk_sample.wav`;
    try {
      const exists = await RNFS.exists(destPath);
      if (!exists) {
        const {promise} = RNFS.downloadFile({
          fromUrl: JFK_SAMPLE_WAV_URL,
          toFile: destPath,
        });
        await promise;
      }
      const {result} = await transcribeWavFile(destPath, {
        language: 'en',
        quickTest30s: true,
        onChunkProgress: chunk => setSampleChunk(chunk),
      });
      setTranscript(prev => (prev ? `${prev} ${result}` : result));
    } catch (err) {
      const msg =
        err != null && typeof err === 'object' && 'message' in err
          ? String((err as Error).message)
          : 'Sample transcription failed';
      setSampleError(msg);
    } finally {
      setSampleTranscribing(false);
      setSampleChunk(null);
    }
  }, [hasOfflineModel, sampleTranscribing]);

  const handleReset = useCallback(() => {
    if (isRecording || isTranscribing) {
      stopVoice();
    }
    resetVoice();
    setTranscript('');
    setSampleError(null);
    setLiveTranscript('');
    setSampleChunk(null);
  }, [isRecording, isTranscribing, stopVoice, resetVoice]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <Card elevation={1} style={styles.card}>
          <Card.Title title="Whisper Test" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.description}>
              Record speech and see the transcript below. Choose Offline (loaded
              ASR model), Live (streaming with local Whisper), or Online (OpenAI Whisper API).
            </Text>

            <View style={styles.toggleRow}>
              <SegmentedButtons
                value={sttMode}
                onValueChange={(v) => setSttMode(v as SttMode)}
                buttons={[
                  {value: 'offline', label: 'Offline'},
                  {value: 'live', label: 'Live (offline)'},
                  {value: 'online', label: 'Online'},
                ]}
              />
            </View>

            {isOnline ? (
              <>
                {!isOnlineSttConfigured() && (
                  <Text variant="bodySmall" style={[styles.description, {color: theme.colors.error}]}>
                    OPENAI_API_KEY is not set. Add it to .env and rebuild the app.
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text variant="labelMedium" style={[styles.description, styles.activeModelLabel]}>
                  Active ASR model:
                </Text>
                <Text variant="bodySmall" style={styles.description}>
                  {activeAsrModel?.name ?? 'None'}
                  {activeAsrModel && !activeAsrModel.isDownloaded && (
                    <Text style={{color: theme.colors.error}}> (not downloaded)</Text>
                  )}
                </Text>
                <Text variant="bodySmall" style={styles.description}>
                  Engine status:{' '}
                  {hasOfflineModel
                    ? whisperLoaded
                      ? 'Whisper context loaded'
                      : 'Preparing speech model…'
                    : 'No offline ASR model available'}
                </Text>
                {!hasOfflineModel && (
                  <Text variant="bodySmall" style={[styles.description, {color: theme.colors.error}]}>
                    Open Models → ASR, download a model and set it active to use Offline.
                  </Text>
                )}
                {hasOfflineModel && (
                  <View style={styles.buttonContainer}>
                    <Button
                      mode="outlined"
                      onPress={handleTranscribeSample}
                      disabled={sampleTranscribing}
                      loading={sampleTranscribing}
                      style={styles.button}
                    >
                      {sampleTranscribing ? 'Transcribing…' : 'Transcribe sample file'}
                    </Button>
                    {sampleTranscribing && sampleChunk != null && (
                      <Text
                        variant="bodySmall"
                        style={[styles.description, {marginTop: 4}]}
                      >
                        Processing sample chunk {sampleChunk}…
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}

            {sttMode === 'live' && !!liveTranscript && (
              <View style={styles.statusRow}>
                <Text
                  variant="bodyMedium"
                  style={{color: theme.colors.onSurfaceVariant, flex: 1}}
                >
                  Live stream:{' '}
                  <Text variant="bodyMedium" style={{color: theme.colors.onSurface}}>
                    {liveTranscript}
                  </Text>
                </Text>
              </View>
            )}

            <TextInput
              style={styles.transcriptField}
              placeholder="Transcribed text will appear here…"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={transcript}
              onChangeText={setTranscript}
              multiline
              editable
              accessibilityLabel="Transcription text field"
            />

            <View style={styles.statusRow}>
              <IconButton
                icon="microphone"
                size={32}
                iconColor={
                  isRecording ? theme.colors.error : theme.colors.primary
                }
                onPress={handleMicPress}
                disabled={!isConfigured}
                style={styles.micButton}
                accessibilityLabel={
                  isRecording ? 'Stop recording' : 'Start recording'
                }
              />
              <IconButton
                icon="refresh"
                size={24}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={handleReset}
                accessibilityLabel="Reset: clear transcript and stop"
              />
              {statusLabel ? (
                <Text variant="bodyMedium" style={{color: theme.colors.onSurfaceVariant}}>
                  {statusLabel}
                </Text>
              ) : null}
            </View>

            {error ? (
              <Text variant="bodySmall" style={{color: theme.colors.error, marginTop: 8}}>
                {error}
              </Text>
            ) : null}
            {sampleError ? (
              <Text variant="bodySmall" style={{color: theme.colors.error, marginTop: 8}}>
                {sampleError}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
});
