import React from 'react';
import {ScrollView, TouchableOpacity, Alert, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, FAB, Chip} from 'react-native-paper';
import {observer} from 'mobx-react-lite';
import {useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {sessionStore} from '../../store';
import type {SessionStackParamList} from './SessionNavigator';

export const SessionListScreen: React.FC = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation<StackNavigationProp<SessionStackParamList, 'SessionList'>>();
  const sessions = sessionStore.sessions;

  const handleNewSession = () => {
    navigation.navigate('Projects');
  };

  const handleSessionPress = (sessionId: string) => {
    navigation.navigate('SessionReview', {sessionId});
  };

  const handleDelete = (sessionId: string) => {
    Alert.alert(
      'Delete interview?',
      'This will permanently remove the interview and all its turns. This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => sessionStore.deleteSession(sessionId),
        },
      ],
    );
  };

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.listContent}>
        <Text variant="titleLarge" style={[styles.title, {fontWeight: '600'}]}>
          Past interviews
        </Text>
        {sessions.length === 0 ? (
          <Card style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text variant="bodyLarge" style={{color: theme.colors.onSurfaceVariant}}>
              No interviews yet
            </Text>
            <Text
              variant="bodySmall"
              style={{color: theme.colors.outline, marginTop: 4, textAlign: 'center'}}>
              Tap "New interview" below to choose a project and start recording responses.
            </Text>
          </Card>
        ) : (
          sessions.map(s => {
            const title =
              (s.respondentName?.trim() || '').length > 0
                ? s.respondentName!
                : `Interview ${s.sessionId.slice(0, 8)}`;
            const dateStr = formatDate(s.updatedAt);
            const isCompleted = s.status === 'completed';
            return (
              <Card
                key={s.sessionId}
                style={styles.card}
                onPress={() => handleSessionPress(s.sessionId)}>
                <Card.Title
                  title={title}
                  subtitle={dateStr}
                  left={() => (
                    <View style={{marginRight: 12, justifyContent: 'center'}}>
                      <Text style={{fontSize: 24}}>
                        {isCompleted ? '✅' : '🎤'}
                      </Text>
                    </View>
                  )}
                  right={() => (
                    <View style={{flexDirection: 'row', alignItems: 'center', paddingRight: 4}}>
                      <Chip
                        compact
                        style={{
                          backgroundColor: isCompleted
                            ? theme.colors.primaryContainer
                            : theme.colors.surfaceVariant,
                          marginRight: 4,
                        }}
                        textStyle={{
                          fontSize: 11,
                          color: isCompleted
                            ? theme.colors.onPrimaryContainer
                            : theme.colors.onSurfaceVariant,
                        }}>
                        {isCompleted ? 'Submitted' : 'In progress'}
                      </Chip>
                      <TouchableOpacity
                        onPress={() => handleDelete(s.sessionId)}
                        style={{padding: 8}}
                        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                        <Text style={{color: theme.colors.error, fontSize: 20}}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </Card>
            );
          })
        )}
      </ScrollView>
      <FAB
        icon="plus"
        label="New interview"
        onPress={handleNewSession}
        style={{position: 'absolute', right: 16, bottom: 16}}
      />
    </SafeAreaView>
  );
});
