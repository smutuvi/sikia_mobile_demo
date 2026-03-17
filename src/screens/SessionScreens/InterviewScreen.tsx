import React, {useState, useCallback, useEffect, useRef} from 'react';
import {View, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Text, IconButton, Button} from 'react-native-paper';
import {observer} from 'mobx-react-lite';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {useWhisperVoiceInput} from '../../hooks/useWhisperVoiceInput';
import type {SttMode} from '../../hooks/useWhisperVoiceInput';
import {sessionStore, modelStore, uiStore, asrModelStore} from '../../store';
import {languageFullNames} from '../../locales';
import {formResponseStore} from '../../store/FormResponseStore';
import {isOnlineSttConfigured} from '../../services/onlineSttService';
import {warmUpAsrModel, isWhisperLoaded} from '../../services/whisperVoiceService';
import type {AnswerCaptureMethod} from '../../types/session';
import type {SessionStackParamList} from './SessionNavigator';

export const InterviewScreen: React.FC = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const route = useRoute<RouteProp<SessionStackParamList, 'Interview'>>();
  const navigation = useNavigation<StackNavigationProp<SessionStackParamList, 'Interview'>>();
  const {sessionId, questionId, formId, targetFieldId} = route.params;

  const session = sessionStore.getSession(sessionId);
  const survey = sessionStore.currentSurvey;
  const question = survey?.questions.find(q => q.questionId === questionId);
  const turns = sessionStore.getTurnsForQuestion(sessionId, questionId);
  const turnCount = turns.length;
  const maxTurns = sessionStore.maxTurnsPerQuestion;
  const hasOfflineAsrModel = Boolean(asrModelStore.activeModel?.isDownloaded);

  const [answerText, setAnswerText] = useState('');
  const [pendingFollowUp, setPendingFollowUp] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const onVoiceResult = useCallback((text: string) => {
    if (text) setAnswerText(prev => (prev ? `${prev} ${text}` : text));
  }, []);

  const asrLanguage = uiStore.language;
  const asrLanguageName = languageFullNames[asrLanguage] ?? 'English';

  const {
    isRecording,
    isTranscribing,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
    reset: resetVoice,
  } = useWhisperVoiceInput({
    onResult: onVoiceResult,
    // Use true offline mode (record then transcribe) for the Offline setting when selected
    mode: uiStore.sttMode as SttMode,
    language: asrLanguage,
  });

  useEffect(() => {
    if (session) sessionStore.ensureSurveyForSession(session);
  }, [session]);

  const currentQuestionText =
    pendingFollowUp ?? (turnCount === 0 ? question?.mainQuestion ?? '' : null);
  const isRequestingFollowUp = sessionStore.isRequestingFollowUp;
  const onlineConfigured = isOnlineSttConfigured();
  const effectiveSttMode: SttMode =
    uiStore.sttMode === 'online' && onlineConfigured ? 'online' : 'offline';
  const whisperReady = isWhisperLoaded();
  const isFormContext = !!formId;

  useEffect(() => {
    if (effectiveSttMode === 'offline' && hasOfflineAsrModel) {
      warmUpAsrModel().catch(() => {
        // Non-fatal: fallback to lazy initialization on first mic use
      });
    }
  }, [effectiveSttMode, hasOfflineAsrModel]);

  const handleSubmit = useCallback(async () => {
    const text = answerText.trim();
    if (!text || !question || !currentQuestionText) return;
    const method: AnswerCaptureMethod =
      effectiveSttMode === 'online' || isRecording ? 'speech' : 'typing';
    sessionStore.addTurn(sessionId, questionId, currentQuestionText, text, method);
    setAnswerText('');
    resetVoice();
    setPendingFollowUp(null);

    const turnsForQuestion = sessionStore.getTurnsForQuestion(sessionId, questionId);
    const updatedTurnCount = turnsForQuestion.length;
    const canAddMoreNow = updatedTurnCount < maxTurns;

    // If we've hit the max turns, stop auto-advancing. Enumerator must
    // explicitly tap "Complete" to move to the next question/review.
    if (!canAddMoreNow) {
      return;
    }
    // Use on-device model only (no online LLMs); use Session low-latency preset
    if (!modelStore.context) {
      uiStore.setChatWarning({
        type: 'error',
        message:
          'No interview LLM is loaded. Open Models → Chat, download a model (e.g. Ndizi interview preset), and set it active before submitting for follow-ups.',
      });
      return;
    }
    if (modelStore.isContextLoading) {
      uiStore.setChatWarning({
        type: 'info',
        message:
          'Interview LLM is still loading. The first follow-up may take a few seconds; please wait, then submit again.',
      });
      return;
    }
    const localCompletion = (sys: string, user: string) =>
      modelStore.runTextCompletion(sys, user, {forSessionFollowUp: true});
    const followUp = await sessionStore.requestFollowUp(
      sessionId,
      questionId,
      currentQuestionText,
      question.targetOutcome,
      question.probeBank,
      text,
      localCompletion,
      asrLanguageName,
    );
    if (followUp) {
      setPendingFollowUp(followUp);
    }
  }, [
    answerText,
    question,
    currentQuestionText,
    sessionId,
    questionId,
    effectiveSttMode,
    isRecording,
    resetVoice,
    maxTurns,
    handleComplete,
  ]);

  const handleMicPress = useCallback(() => {
    // Guard: for offline STT we need a downloaded + loaded ASR model
    if (effectiveSttMode === 'offline') {
      if (!hasOfflineAsrModel) {
        uiStore.setChatWarning({
          type: 'error',
          message:
            'No ASR model downloaded. Open Models → ASR, download a model, and set it active before using voice input.',
        });
        return;
      }
  	    if (!whisperReady) {
  	      // Show a hint but still allow the first mic press to trigger lazy load.
  	      uiStore.setChatWarning({
  	        type: 'info',
  	        message:
  	          'Loading the ASR model… The first voice input may take a few seconds.',
  	      });
  	    }
    }
    if (isRecording || isTranscribing) {
      stopVoice();
    } else {
      // When starting a new recording, clear any existing typed text
      setAnswerText('');
      startVoice();
    }
  }, [
    isRecording,
    isTranscribing,
    startVoice,
    stopVoice,
    setAnswerText,
    effectiveSttMode,
    hasOfflineAsrModel,
    whisperReady,
  ]);

  const handleComplete = useCallback(() => {
    // When opened from FormFill: write transcript back and go back to form.
    if (formId && targetFieldId) {
      const turnsForQuestion = sessionStore.getTurnsForQuestion(sessionId, questionId);
      const transcript = turnsForQuestion
        .filter(t => t.answerText?.trim())
        .map(t => {
          const lines: string[] = [];
          if (t.questionText?.trim()) {
            lines.push(`[Enumerator]: ${t.questionText.trim()}`);
          }
          lines.push(`[Respondent]: ${t.answerText.trim()}`);
          return lines.join('\n');
        })
        .join('\n');
      formResponseStore.setResponse(formId, targetFieldId, transcript);
      navigation.goBack();
      return;
    }
    if (!survey) {
      navigation.navigate('QuestionList', {sessionId});
      return;
    }
    const index = survey.questions.findIndex(q => q.questionId === questionId);
    const next = index >= 0 ? survey.questions[index + 1] : undefined;
    if (next) {
      setIsTransitioning(true);
      setTimeout(() => {
        navigation.replace('Interview', {sessionId, questionId: next.questionId});
      }, 800);
    } else {
      navigation.navigate('SessionReview', {sessionId});
    }
  }, [navigation, sessionId, survey, questionId, formId, targetFieldId]);

  if (!session || !survey || !question) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}>
        <View style={{flex: 1}}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.outlineVariant,
            }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              {formId ? (
                <IconButton
                  icon="arrow-left"
                  size={20}
                  onPress={() => navigation.goBack()}
                  style={{marginRight: 4}}
                />
              ) : null}
              <Text variant="labelLarge">
                {(() => {
                  const base =
                    turnCount + (currentQuestionText || isRequestingFollowUp ? 1 : 0);
                  const displayTurn = Math.min(base, maxTurns);
                  return `Turn ${displayTurn} / ${maxTurns}`;
                })()}
              </Text>
            </View>
            <Button mode="outlined" compact onPress={handleComplete}>
              Complete
            </Button>
          </View>

          <ScrollView
            ref={scrollRef}
            style={{flex: 1}}
            contentContainerStyle={{padding: 12, paddingBottom: 16}}
            keyboardShouldPersistTaps="handled">
            {isFormContext && (
              <View style={{marginBottom: 8}}>
                <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
                  Filling form voice response
                </Text>
              </View>
            )}
            {turns.map(t => (
              <View key={t.turnId} style={{marginBottom: 8}}>
                <View style={[styles.bubbleLeft, {backgroundColor: theme.colors.surfaceContainerHigh}]}>
                  <Text variant="bodyMedium" style={{color: theme.colors.onSurface}}>
                    {t.questionText}
                  </Text>
                </View>
                <View style={[styles.bubbleRight, {backgroundColor: theme.colors.secondaryContainer}]}>
                  <Text variant="bodyMedium" style={{color: theme.colors.onSecondaryContainer}}>
                    {t.answerText}
                  </Text>
                </View>
              </View>
            ))}
            {currentQuestionText ? (
              <View style={[styles.bubbleLeft, {backgroundColor: theme.colors.surfaceContainerHigh}]}>
                <Text variant="bodyMedium" style={{color: theme.colors.onSurface}}>
                  {currentQuestionText}
                </Text>
              </View>
            ) : null}
            {isRequestingFollowUp ? (
              <View style={[styles.thinkingBubble, {backgroundColor: theme.colors.surfaceContainerHigh}]}>
                <Text variant="bodyMedium" style={{color: theme.colors.onSurface}}>
                  Generating follow-up…
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {isTransitioning ? (
            <View
              style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: theme.colors.outlineVariant,
                backgroundColor: theme.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <ActivityIndicator size="small" color={theme.colors.primary} style={{marginBottom: 8}} />
              <Text variant="bodyLarge" style={{color: theme.colors.onSurface, fontWeight: '500'}}>
                Moving to next question…
              </Text>
            </View>
          ) : isRequestingFollowUp ? (
            <View
              style={{
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: theme.colors.outlineVariant,
                backgroundColor: theme.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <ActivityIndicator size="small" color={theme.colors.primary} style={{marginBottom: 8}} />
              <Text variant="bodyLarge" style={{color: theme.colors.onSurface, fontWeight: '500'}}>
                Generating follow-up…
              </Text>
              <Text
                variant="bodySmall"
                style={{color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center'}}>
                This may take a few seconds. Using your device model.
              </Text>
            </View>
          ) : currentQuestionText ? (
            <View
              style={{
                padding: 12,
                borderTopWidth: 1,
                borderTopColor: theme.colors.outlineVariant,
                backgroundColor: theme.colors.surface,
              }}>
              <Text
                variant="bodySmall"
                style={{color: theme.colors.onSurfaceVariant, marginBottom: 8}}>
                {effectiveSttMode === 'online'
                  ? 'Using online STT model'
                  : whisperReady
                    ? 'Using offline STT model'
                    : 'Preparing speech model…'}
              </Text>
              <TextInput
                style={styles.answerInput}
                placeholder="Type or use mic..."
                placeholderTextColor={theme.colors.onSurfaceVariant}
                value={answerText}
                onChangeText={setAnswerText}
                multiline
              />
              <View style={[styles.row, {marginTop: 8}]}>
                <IconButton
                  icon="microphone"
                  size={28}
                  iconColor={isRecording ? theme.colors.error : theme.colors.primary}
                  onPress={handleMicPress}
                />
                {isRecording || isTranscribing ? (
                  <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
                    {isTranscribing ? 'Processing…' : 'Listening…'}
                  </Text>
                ) : null}
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  disabled={!answerText.trim()}
                  style={{marginLeft: 8}}>
                  Submit
                </Button>
              </View>
              {voiceError ? (
                <Text variant="bodySmall" style={styles.error}>{voiceError}</Text>
              ) : null}
              {!modelStore.context ? (
                <Text
                  variant="bodySmall"
                  style={{color: theme.colors.outline, marginTop: 8}}>
                  Load a model in Models to get follow-up suggestions.
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{padding: 16, alignItems: 'center'}}>
              <Text variant="bodyMedium" style={{color: theme.colors.onSurfaceVariant}}>
                No more follow-ups. You can complete this question.
              </Text>
              <Button mode="contained" onPress={handleComplete} style={{marginTop: 12}}>
                Complete
              </Button>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});
