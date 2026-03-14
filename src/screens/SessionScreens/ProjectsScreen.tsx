import React, {useEffect, useState, useCallback} from 'react';
import {ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, ActivityIndicator, Button} from 'react-native-paper';
import {observer} from 'mobx-react-lite';
import {useNavigation, CommonActions} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {fetchProjects, getCachedProjects, clearProjectsCache} from '../../services/mobileApi';
import type {Project} from '../../types/project';
import {getSikiaAuthBaseUrl, sikiaAuthService} from '../../services/sikiaAuth';
import type {SessionStackParamList} from './SessionNavigator';

export const ProjectsScreen: React.FC = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const navigation =
    useNavigation<StackNavigationProp<SessionStackParamList, 'Projects'>>();

  const [projects, setProjects] = useState<Project[]>(() => getCachedProjects() ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);

  const handleSignIn = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'Login' as never}]}),
    );
  }, [navigation]);

  const loadProjects = useCallback(async () => {
    setError(null);
    setIsAuthError(false);
    setLoading(true);
    try {
      const baseUrl = getSikiaAuthBaseUrl().replace(/\/$/, '');
      const token = await sikiaAuthService.getIdToken();
      if (!token) {
        setIsAuthError(true);
        setError('Your session has expired. Please sign in again.');
        return;
      }
      const result = await fetchProjects({baseUrl, token});
      const published = result.filter(p => p.published);
      setProjects(published);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleViewSessions = useCallback(() => {
    navigation.navigate('SessionList');
  }, [navigation]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleProjectPress = useCallback(
    (project: Project) => {
      navigation.navigate('Forms', {
        projectId: project.id,
        projectName: project.name,
      });
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.listContent}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
          <Text
            variant="titleLarge"
            style={[styles.title, {fontWeight: '600'}]}>
            Projects
          </Text>
          <Button mode="text" onPress={handleViewSessions}>
            Past interviews
          </Button>
        </View>

        {loading && projects.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <ActivityIndicator size="small" style={{marginBottom: 12}} />
            <Text>Loading projects...</Text>
          </View>
        ) : error ? (
          <Card style={[styles.card, styles.emptyCard]}>
            <Text style={{color: theme.colors.error, marginBottom: 12}}>
              {error}
            </Text>
            {isAuthError ? (
              <Button mode="contained" onPress={handleSignIn}>
                Sign in
              </Button>
            ) : (
              <Button mode="outlined" onPress={loadProjects}>
                Retry
              </Button>
            )}
          </Card>
        ) : projects.length === 0 ? (
          <Card style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text
              variant="bodyLarge"
              style={{color: theme.colors.onSurfaceVariant}}>
              No projects available
            </Text>
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.outline,
                marginTop: 4,
                textAlign: 'center',
              }}>
              Once projects are assigned to your account, they will appear here.
            </Text>
          </Card>
        ) : (
          projects.map(project => (
            <Card
              key={project.id}
              style={styles.card}
              onPress={() => handleProjectPress(project)}>
              <Card.Title
                title={project.name}
                subtitle={project.published ? 'Published' : 'Unpublished'}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
});

