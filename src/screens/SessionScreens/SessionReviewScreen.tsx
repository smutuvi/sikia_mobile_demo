import React from 'react';
import {ScrollView, View, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, Button, Chip} from 'react-native-paper';
import {observer} from 'mobx-react-lite';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {sessionStore, syncStore} from '../../store';
import type {SessionStackParamList} from './SessionNavigator';

export const SessionReviewScreen: React.FC = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const route = useRoute<RouteProp<SessionStackParamList, 'SessionReview'>>();
  const navigation = useNavigation<StackNavigationProp<SessionStackParamList, 'SessionReview'>>();
  const {sessionId} = route.params;

  const session = sessionStore.getSession(sessionId);

  const handleBackToQuestions = () => {
    navigation.navigate('QuestionList', {sessionId});
  };

  const handleMarkComplete = async () => {
    const currentSession = sessionStore.getSession(sessionId);
    if (!currentSession) return;

    const survey = await sessionStore.ensureSurveyForSession(currentSession);
    const totalQuestions = survey?.questions.length ?? 0;
    const answeredQuestions = new Set(currentSession.turns.map(t => t.questionId)).size;
    const unanswered = totalQuestions > 0 ? totalQuestions - answeredQuestions : 0;

    const doSubmit = async () => {
      sessionStore.updateSessionStatus(sessionId, 'completed');
      const updated = sessionStore.getSession(sessionId);
      if (updated) {
        await syncStore.enqueueSession(updated);
        Alert.alert(
          'Submitted',
          'This interview has been submitted and queued for upload.',
          [{text: 'OK'}],
        );
      }
    };

    if (unanswered > 0) {
      Alert.alert(
        'Incomplete interview',
        `You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}. Submit anyway?`,
        [
          {text: 'Go back', style: 'cancel'},
          {text: 'Submit anyway', style: 'destructive', onPress: doSubmit},
        ],
      );
    } else {
      Alert.alert(
        'Submit interview?',
        'This will finalise the interview and queue it for upload. You cannot undo this.',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Submit', onPress: doSubmit},
        ],
      );
    }
  };

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleString();
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Session not found.</Text>
      </SafeAreaView>
    );
  }

  const turnsByQuestion = new Map<string, typeof session.turns>();
  for (const t of session.turns) {
    if (!turnsByQuestion.has(t.questionId)) {
      turnsByQuestion.set(t.questionId, []);
    }
    turnsByQuestion.get(t.questionId)!.push(t);
  }
  for (const arr of turnsByQuestion.values()) {
    arr.sort((a, b) => a.turnNumber - b.turnNumber);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.listContent}>
        <Text variant="titleLarge" style={[styles.title, {fontWeight: '600'}]}>
          Interview review
        </Text>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
              Respondent
            </Text>
            <Text variant="bodyLarge" style={{marginBottom: 8}}>
              {session.respondentName || '—'}
            </Text>
            <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
              Location
            </Text>
            <Text variant="bodyLarge" style={{marginBottom: 8}}>
              {session.location || '—'}
            </Text>
            <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
              Survey
            </Text>
            <Text variant="bodyLarge" style={{marginBottom: 8}}>
              {session.surveyName}
            </Text>
            <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
              Updated
            </Text>
            <Text variant="bodyLarge" style={{marginBottom: 8}}>
              {formatDate(session.updatedAt)}
            </Text>
            <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
              Status
            </Text>
            <Chip
              style={{
                alignSelf: 'flex-start',
                marginTop: 4,
                backgroundColor:
                  session.status === 'completed'
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceVariant,
              }}
              textStyle={{
                color:
                  session.status === 'completed'
                    ? theme.colors.onPrimaryContainer
                    : theme.colors.onSurfaceVariant,
              }}>
              {session.status === 'completed' ? 'Completed' : 'In progress'}
            </Chip>
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={{fontWeight: '600', marginTop: 16, marginBottom: 8}}>
          Turns
        </Text>
        {session.turns.length === 0 ? (
          <Card style={[styles.card, styles.emptyCard]}>
            <Text variant="bodyMedium" style={{color: theme.colors.onSurfaceVariant}}>
              No answers yet. Open a question from the question list to start.
            </Text>
          </Card>
        ) : (
          Array.from(turnsByQuestion.entries()).map(([qId, qTurns]) => {
            const firstTurn = qTurns[0];
            const title = firstTurn?.questionText?.trim()
              ? firstTurn.questionText.trim()
              : `Question ${qId}`;
            return (
              <Card key={qId} style={styles.card}>
                <Card.Title
                  title={title}
                  subtitle={`${qTurns.length} turn(s)`}
                />
                <Card.Content>
                  {qTurns.map(t => (
                    <View key={t.turnId} style={{marginBottom: 12}}>
                      <Text variant="labelSmall" style={{color: theme.colors.onSurfaceVariant}}>
                        Turn {t.turnNumber}
                      </Text>
                      <View style={[styles.bubbleLeft, {backgroundColor: theme.colors.surfaceContainerHigh, marginVertical: 4}]}>
                        <Text variant="bodySmall" style={{color: theme.colors.onSurface}}>
                          {t.questionText}
                        </Text>
                      </View>
                      <View style={[styles.bubbleRight, {backgroundColor: theme.colors.secondaryContainer}]}>
                        <Text variant="bodySmall" style={{color: theme.colors.onSecondaryContainer}}>
                          {t.answerText}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            );
          })
        )}

        <View style={{flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 24}}>
          <Button mode="outlined" onPress={handleBackToQuestions}>
            Back to questions
          </Button>
          {session.status === 'in_progress' && (
            <Button mode="contained" onPress={handleMarkComplete}>
              Submit session
            </Button>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
});
