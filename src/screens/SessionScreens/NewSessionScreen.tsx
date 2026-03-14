import React, {useState, useCallback, useEffect} from 'react';
import {ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, Button, ActivityIndicator} from 'react-native-paper';
import {observer} from 'mobx-react-lite';
import {useNavigation} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {useTheme as useAppTheme} from '../../hooks';
import {createStyles} from './styles';
import {sessionStore} from '../../store';
import {fetchProjects, fetchProjectForms} from '../../services/mobileApi';
import {formItemToSurveyDefinition} from '../../services/formSurveyMapper';
import type {Project, FormItem} from '../../types/project';
import {getSikiaAuthBaseUrl, sikiaAuthService} from '../../services/sikiaAuth';
import type {SessionStackParamList} from './SessionNavigator';

export const NewSessionScreen: React.FC = observer(() => {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation<StackNavigationProp<SessionStackParamList, 'NewSession'>>();
  const [loading, setLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [formsLoading, setFormsLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      setApiError(null);
      setProjectsLoading(true);
      try {
        const baseUrl = getSikiaAuthBaseUrl().replace(/\/$/, '');
        const token = await sikiaAuthService.getIdToken();
        if (!token) {
          setApiError('You must be logged in to load projects.');
          return;
        }
        const result = await fetchProjects({baseUrl, token});
        const published = result.filter(p => p.published);
        setProjects(published);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setApiError(msg);
      } finally {
        setProjectsLoading(false);
      }
    };
    loadProjects();
  }, []);

  const handleSelectProject = useCallback(
    async (projectId: string) => {
      if (projectId === selectedProjectId) return;
      setSelectedProjectId(projectId);
      setSelectedFormId(null);
      setForms([]);
      setApiError(null);
      try {
        const baseUrl = getSikiaAuthBaseUrl().replace(/\/$/, '');
        const token = await sikiaAuthService.getIdToken();
        if (!token) {
          setApiError('You must be logged in to load forms.');
          return;
        }
        setFormsLoading(true);
        const res = await fetchProjectForms({baseUrl, token, projectId});
        setForms(res.forms);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setApiError(msg);
      } finally {
        setFormsLoading(false);
      }
    },
    [selectedProjectId],
  );

  const handleStart = useCallback(async () => {
    if (!selectedFormId) {
      setApiError('Please select a form before starting an interview.');
      return;
    }
    const form = forms.find(f => f.id === selectedFormId);
    if (!form) {
      setApiError('Selected form not found.');
      return;
    }

    setLoading(true);
    sessionStore.clearError();
    try {
      const survey = formItemToSurveyDefinition(form);
      const sessionId = await sessionStore.createSession({
        survey,
        surveySource: `api:project:${form.projectId}:form:${form.id}`,
      });
      navigation.replace('QuestionList', {sessionId});
    } catch (e) {
      // error in store
    } finally {
      setLoading(false);
    }
  }, [forms, selectedFormId, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{padding: 24}}>
        <Text variant="titleLarge" style={{fontWeight: '600', marginBottom: 20}}>
          New session
        </Text>
        <Text variant="labelMedium" style={{marginBottom: 4}}>Project</Text>
        {projectsLoading && projects.length === 0 ? (
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
            <ActivityIndicator size="small" style={{marginRight: 8}} />
            <Text>Loading projects...</Text>
          </View>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingVertical: 4}}>
          {projects.map(project => (
            <Button
              key={project.id}
              mode={project.id === selectedProjectId ? 'contained' : 'outlined'}
              style={{marginRight: 8}}
              onPress={() => handleSelectProject(project.id)}>
              {project.name}
            </Button>
          ))}
        </ScrollView>
        <Text variant="labelMedium" style={{marginBottom: 4, marginTop: 12}}>
          Form
        </Text>
        {formsLoading && forms.length === 0 ? (
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
            <ActivityIndicator size="small" style={{marginRight: 8}} />
            <Text>Loading forms...</Text>
          </View>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingVertical: 4}}>
          {forms.map(form => (
            <Button
              key={form.id}
              mode={form.id === selectedFormId ? 'contained' : 'outlined'}
              style={{marginRight: 8}}
              onPress={() => setSelectedFormId(form.id)}>
              {form.title}
            </Button>
          ))}
        </ScrollView>
        <Button
          mode="contained"
          onPress={handleStart}
          loading={loading}
          disabled={loading}
          style={{marginTop: 24}}>
          Start interview
        </Button>
        {(sessionStore.error || apiError) ? (
          <Text style={[styles.error, {marginTop: 12}]}>
            {sessionStore.error ?? apiError}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
});
