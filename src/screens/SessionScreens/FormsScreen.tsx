import React, {useEffect, useState, useCallback} from 'react';
import {ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, ActivityIndicator, Button} from 'react-native-paper';
import {observer} from 'mobx-react-lite';
import {useNavigation, useRoute, RouteProp, CommonActions} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {fetchProjectForms} from '../../services/mobileApi';
import type {FormItem} from '../../types/project';
import {getSikiaAuthBaseUrl, sikiaAuthService} from '../../services/sikiaAuth';
import type {SessionStackParamList} from './SessionNavigator';

type FormsRoute = RouteProp<SessionStackParamList, 'Forms'>;

export const FormsScreen: React.FC = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const navigation =
    useNavigation<StackNavigationProp<SessionStackParamList, 'Forms'>>();
  const route = useRoute<FormsRoute>();
  const {projectId, projectName} = route.params;

  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);

  const handleSignIn = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'Login' as never}]}),
    );
  }, [navigation]);

  const loadForms = useCallback(async () => {
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
      const res = await fetchProjectForms({baseUrl, token, projectId});
      setForms(res.forms);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  const handleFormPress = useCallback(
    (form: FormItem) => {
      navigation.navigate('FormFill', {form});
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.listContent}>
        <Text
          variant="titleLarge"
          style={[styles.title, {fontWeight: '600', marginBottom: 4}]}>
          {projectName || 'Forms'}
        </Text>
        <Text
          variant="bodySmall"
          style={{color: theme.colors.outline, marginBottom: 16}}>
          Select a form to fill out.
        </Text>

        {loading && forms.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <ActivityIndicator size="small" style={{marginBottom: 12}} />
            <Text>Loading forms...</Text>
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
              <Button mode="outlined" onPress={loadForms}>
                Retry
              </Button>
            )}
          </Card>
        ) : forms.length === 0 ? (
          <Card style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text
              variant="bodyLarge"
              style={{color: theme.colors.onSurfaceVariant}}>
              No forms available
            </Text>
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.outline,
                marginTop: 4,
                textAlign: 'center',
              }}>
              This project does not have any forms assigned yet.
            </Text>
          </Card>
        ) : (
          forms.map(form => (
            <Card
              key={form.id}
              style={styles.card}
              onPress={() => handleFormPress(form)}>
              <Card.Title
                title={form.title}
                subtitle={form.type || 'Survey'}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
});

