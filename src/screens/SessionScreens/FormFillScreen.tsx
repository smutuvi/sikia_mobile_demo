import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react';
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, Button, useTheme} from 'react-native-paper';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import type {StackNavigationProp} from '@react-navigation/stack';
import type {RouteProp} from '@react-navigation/native';

import type {FormItem, FormSection, FormWidget} from '../../types/project';
import type {SessionStackParamList} from './SessionNavigator';
import {useTheme as useAppTheme} from '../../hooks';
import {createStyles} from './styles';
import {
  isVoiceWidget,
  isGenericQuestionLabel,
  getWrittenResponseWidgetInSection,
  getTargetFieldIdForVoiceWidget,
} from '../../utils/formWidgetUtils';
import {formResponseStore} from '../../store/FormResponseStore';
import {sessionStore} from '../../store';
import {formItemToVoiceSurveyDefinition} from '../../services/formSurveyMapper';
import {submitForm, UnauthorizedError} from '../../services/mobileApi';
import {getSikiaAuthBaseUrl, sikiaAuthService} from '../../services/sikiaAuth';

function useFormValues(formId: string) {
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    formResponseStore.getFormValues(formId),
  );

  useFocusEffect(
    useCallback(() => {
      setValues(formResponseStore.getFormValues(formId));
    }, [formId]),
  );

  const setResponse = useCallback((fieldId: string, value: unknown) => {
    formResponseStore.setResponse(formId, fieldId, value);
    setValues(prev => ({...prev, [fieldId]: value}));
  }, [formId]);

  return [values, setResponse] as const;
}

function buildLinkedWrittenResponseIds(section: FormSection): Set<string> {
  const ids = new Set<string>();
  for (const w of section.widgets) {
    if (isVoiceWidget(w)) {
      const written = getWrittenResponseWidgetInSection(section, w);
      if (written) ids.add(written.id);
    }
  }
  return ids;
}

export const FormFillScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<StackNavigationProp<SessionStackParamList, 'FormFill'>>();
  const route = useRoute<RouteProp<SessionStackParamList, 'FormFill'>>();
  const form = route.params?.form;

  const [values, setResponse] = useFormValues(form?.id ?? '');
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const hasUnsavedData = useMemo(
    () => Object.values(values).some(v => {
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      return String(v).trim() !== '';
    }),
    [values],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (submittedRef.current) return;
      // Check the store directly — local state may still have data after an
      // external clear (e.g. logout calls clearAll before navigation.reset).
      const storedValues = form?.id
        ? formResponseStore.getFormValues(form.id)
        : {};
      const storeHasData = Object.values(storedValues).some(v => {
        if (v == null) return false;
        if (Array.isArray(v)) return (v as unknown[]).length > 0;
        return String(v).trim() !== '';
      });
      if (!storeHasData) return;
      e.preventDefault();
      Alert.alert(
        'Discard unsaved answers?',
        'You have unsaved answers for this form. Going back will discard them.',
        [
          {text: 'Keep filling', style: 'cancel'},
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              if (form?.id) formResponseStore.clearForm(form.id);
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, form?.id]);

  const allRequiredFilled = useMemo(() => {
    if (!form) return false;
    for (const section of form.structure.sections) {
      for (const w of section.widgets) {
        if (!w.required) continue;
        const v = values[w.id];
        if (v == null) return false;
        if (Array.isArray(v) && v.length === 0) return false;
        if (String(v).trim() === '') return false;
      }
    }
    return true;
  }, [form, values]);

  const handleAnswerWithVoice = useCallback(
    async (widget: FormWidget, section: FormSection) => {
      if (!form) return;
      const targetField = getWrittenResponseWidgetInSection(section, widget) ?? widget;
      const targetFieldId = targetField.id;
      const transcriptValue = (values[targetFieldId] ?? '') as string;

      const startInterview = async () => {
        const voiceSurvey = formItemToVoiceSurveyDefinition(form);
        const surveyHasQuestion = voiceSurvey.questions.some(q => q.questionId === widget.id);
        if (!surveyHasQuestion) {
          Alert.alert('Not available', 'This question is not configured for voice input.');
          return;
        }
        try {
          const sessionId = await sessionStore.createSession({
            survey: voiceSurvey,
            surveySource: `api:project:${form.projectId}:form:${form.id}`,
          });
          navigation.navigate('Interview', {
            sessionId,
            questionId: widget.id,
            formId: form.id,
            targetFieldId: getTargetFieldIdForVoiceWidget(form, widget.id),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          sessionStore.error = msg;
        }
      };

      if (transcriptValue.trim() !== '') {
        // Optional: could push an "edit field" screen; for now just allow re-answering
        await startInterview();
        return;
      }
      await startInterview();
    },
    [form, values, navigation],
  );

  const handleSubmit = useCallback(async () => {
    if (!form || submitting || !allRequiredFilled) return;
    setSubmitting(true);
    try {
      const baseUrl = getSikiaAuthBaseUrl().replace(/\/$/, '');
      const token = await sikiaAuthService.getIdToken();
      if (!token) {
        Alert.alert('Not signed in', 'Please sign in to submit the form.');
        setSubmitting(false);
        return;
      }
      const answers = formResponseStore.getFormValues(form.id);
      await submitForm({
        baseUrl,
        token,
        form,
        answers,
      });
      submittedRef.current = true;
      formResponseStore.clearForm(form.id);
      Alert.alert('Success', 'Form submitted.', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        Alert.alert(
          'Session expired',
          'Please sign in again.',
          [{text: 'OK', onPress: () => navigation.goBack()}],
        );
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert('Submit failed', msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, submitting, allRequiredFilled, navigation]);

  if (!form) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>No form selected.</Text>
      </SafeAreaView>
    );
  }

  const structure = form.structure;
  if (!structure?.sections?.length) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{color: theme.colors.onSurfaceVariant}}>This form has no sections.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.listContent, {paddingBottom: 32}]}
        keyboardShouldPersistTaps="handled">
        <View style={sectionStyles.breadcrumbRow}>
          <Button
            mode="text"
            compact
            onPress={() => navigation.navigate('Projects')}>
            Projects
          </Button>
          <Text style={{marginHorizontal: 4}}>›</Text>
          <Button
            mode="text"
            compact
            onPress={() =>
              navigation.navigate('Forms', {
                projectId: form.projectId,
                projectName: undefined,
              })
            }>
            Forms
          </Button>
          <Text style={{marginHorizontal: 4}}>›</Text>
          <Text variant="labelMedium" numberOfLines={1} style={{flex: 1}}>
            {form.title}
          </Text>
        </View>
        {structure.sections.map((section: FormSection) => (
          <View key={section.title || 'section'} style={sectionStyles.section}>
            {section.title ? (
              <Text
                variant="titleMedium"
                style={[sectionStyles.sectionTitle, {color: theme.colors.primary}]}>
                {section.title}
              </Text>
            ) : null}
            {section.description ? (
              <Text
                variant="bodyMedium"
                style={[sectionStyles.sectionDesc, {color: theme.colors.onSurfaceVariant}]}>
                {section.description}
              </Text>
            ) : null}
            {section.widgets.map((w: FormWidget) => {
              const linkedWrittenIds = buildLinkedWrittenResponseIds(section);
              const isLinkedWritten = linkedWrittenIds.has(w.id);

              if (isVoiceWidget(w)) {
                const written = getWrittenResponseWidgetInSection(section, w);
                const targetField = written ?? w;
                const targetId = targetField.id;
                const transcriptValue = (values[targetId] ?? '') as string;

                return (
                  <Card key={w.id} style={[styles.card, sectionStyles.voiceCard]} mode="elevated">
                    <Card.Content>
                      {transcriptValue ? (
                        <Text
                          variant="bodySmall"
                          style={{color: theme.colors.primary, fontWeight: '500', marginBottom: 12}}>
                          Answered
                        </Text>
                      ) : null}
                      <Button
                        mode="contained-tonal"
                        icon={transcriptValue ? 'pencil' : 'microphone'}
                        onPress={() => handleAnswerWithVoice(w, section)}
                        style={{alignSelf: 'flex-start'}}>
                        {transcriptValue ? 'Change answer' : 'Voice Response'}
                      </Button>
                    </Card.Content>
                  </Card>
                );
              }

              const t = (w.type || '').toLowerCase();
              const rawLabel = w.label || '';
              const isGenericLabel = isGenericQuestionLabel(rawLabel);
              const label = (isGenericLabel ? '' : rawLabel) + (w.required && !isGenericLabel ? ' *' : '');
              const hint = w.hint;
              const value = values[w.id];
              const defaultValue = w.defaultValue != null ? String(w.defaultValue) : '';
              const displayValue = value != null ? String(value) : defaultValue;

              if (t === 'text' || t === 'string') {
                const multiline = isLinkedWritten && displayValue.includes('\n');
                return (
                  <View key={w.id} style={sectionStyles.field}>
                    {label ? (
                      <Text variant="labelSmall" style={sectionStyles.fieldLabel}>
                        {label}
                      </Text>
                    ) : null}
                    <TextInput
                      style={[
                        styles.input,
                        multiline && {minHeight: 100, textAlignVertical: 'top'},
                      ]}
                      placeholder={hint || ''}
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      value={displayValue}
                      onChangeText={v => setResponse(w.id, v)}
                      multiline={multiline}
                      numberOfLines={multiline ? 5 : 1}
                    />
                  </View>
                );
              }

              if (t === 'integer' || t === 'decimal' || t === 'number') {
                return (
                  <View key={w.id} style={sectionStyles.field}>
                    <Text variant="labelSmall" style={sectionStyles.fieldLabel}>
                      {label}
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder={hint}
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      value={displayValue}
                      onChangeText={v => setResponse(w.id, v)}
                      keyboardType="decimal-pad"
                    />
                  </View>
                );
              }

              if (t === 'select_one' && w.options?.length) {
                const current = (values[w.id] ?? '') as string;
                return (
                  <View key={w.id} style={sectionStyles.field}>
                    <Text variant="labelSmall" style={sectionStyles.fieldLabel}>
                      {label}
                    </Text>
                    <View style={sectionStyles.pickerRow}>
                      {w.options.map(opt => (
                        <Button
                          key={opt.code}
                          mode={current === opt.code ? 'contained-tonal' : 'outlined'}
                          compact
                          onPress={() => setResponse(w.id, opt.code)}>
                          {opt.label}
                        </Button>
                      ))}
                    </View>
                  </View>
                );
              }

              if (t === 'select_multiple' && w.options?.length) {
                const currentSet = new Set<string>();
                const cur = values[w.id];
                if (Array.isArray(cur)) cur.forEach((e: unknown) => currentSet.add(String(e)));
                else if (cur != null) currentSet.add(String(cur));
                return (
                  <View key={w.id} style={sectionStyles.field}>
                    <Text variant="labelSmall" style={sectionStyles.fieldLabel}>
                      {label}
                    </Text>
                    {w.options.map(opt => (
                      <Button
                        key={opt.code}
                        mode={currentSet.has(opt.code) ? 'contained-tonal' : 'outlined'}
                        compact
                        onPress={() => {
                          const next = new Set(currentSet);
                          if (next.has(opt.code)) next.delete(opt.code);
                          else next.add(opt.code);
                          setResponse(w.id, Array.from(next));
                        }}>
                        {opt.label}
                      </Button>
                    ))}
                  </View>
                );
              }

              // Fallback: text field
              return (
                <View key={w.id} style={sectionStyles.field}>
                  <Text variant="labelSmall" style={sectionStyles.fieldLabel}>
                    {label}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder={hint}
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    value={displayValue}
                    onChangeText={v => setResponse(w.id, v)}
                  />
                </View>
              );
            })}
          </View>
        ))}

        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={!allRequiredFilled || submitting}
          style={{marginTop: 24, paddingVertical: 8}}>
          {submitting ? (
            <ActivityIndicator size="small" color={theme.colors.onPrimary} />
          ) : (
            'Submit'
          )}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
};

const sectionStyles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDesc: {
    marginBottom: 8,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    marginBottom: 4,
  },
  voiceCard: {
    marginBottom: 16,
    backgroundColor: 'rgba(46, 125, 50, 0.08)',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
