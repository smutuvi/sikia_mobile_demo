import React, {useEffect, useState, useCallback} from 'react';
import {ScrollView, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text} from 'react-native-paper';
import {observer} from 'mobx-react-lite';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {sessionStore} from '../../store';
import type {SessionStackParamList} from './SessionNavigator';
import type {SurveyQuestion} from '../../types/session';

export const QuestionListScreen: React.FC = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const route = useRoute<RouteProp<SessionStackParamList, 'QuestionList'>>();
  const navigation = useNavigation<StackNavigationProp<SessionStackParamList, 'QuestionList'>>();
  const {sessionId} = route.params;

  const session = sessionStore.getSession(sessionId);
  const [surveyReady, setSurveyReady] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!session) return;
    sessionStore.ensureSurveyForSession(session).then(survey => {
      setSurveyReady(!!survey);
    });
  }, [session]);

  const questions: SurveyQuestion[] = sessionStore.currentSurvey?.questions ?? [];
  const filtered = search.trim()
    ? questions.filter(
        q =>
          q.mainQuestion.toLowerCase().includes(search.toLowerCase()) ||
          q.questionId.toLowerCase().includes(search.toLowerCase()),
      )
    : questions;

  const handleQuestionPress = useCallback(
    (questionId: string) => {
      navigation.navigate('Interview', {sessionId, questionId});
    },
    [sessionId, navigation],
  );

  const turnCountForQuestion = useCallback(
    (questionId: string) => sessionStore.getTurnsForQuestion(sessionId, questionId).length,
    [sessionId],
  );

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Session not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={{paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8}}>
        <Text variant="titleMedium" style={{fontWeight: '600', marginBottom: 8}}>
          {session.respondentName || 'Session'} · {session.surveyName}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Search questions..."
          placeholderTextColor={theme.colors.onSurfaceVariant}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <ScrollView contentContainerStyle={styles.listContent}>
        {!surveyReady ? (
          <Card style={[styles.card, styles.emptyCard]}>
            <Text>Loading survey...</Text>
          </Card>
        ) : filtered.length === 0 ? (
          <Card style={[styles.card, styles.emptyCard]}>
            <Text>No questions match your search.</Text>
          </Card>
        ) : (
          filtered.map(q => {
            const turns = turnCountForQuestion(q.questionId);
            return (
              <Card
                key={q.questionId}
                style={styles.card}
                onPress={() => handleQuestionPress(q.questionId)}>
                <Card.Title
                  title={q.mainQuestion}
                  subtitle={turns > 0 ? `${turns} turn(s)` : 'Not started'}
                  left={props => (
                    <View style={{marginRight: 12, justifyContent: 'center'}}>
                      <Text style={{fontSize: 24}}>{turns > 0 ? '✓' : '○'}</Text>
                    </View>
                  )}
                />
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
});
