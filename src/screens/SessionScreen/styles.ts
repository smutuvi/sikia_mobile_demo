import {StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    card: {
      marginHorizontal: 16,
      marginVertical: 8,
      backgroundColor: theme.colors.surface,
    },
    questionCard: {
      marginHorizontal: 16,
      marginVertical: 8,
      backgroundColor: theme.colors.surfaceContainerLow,
      padding: 16,
    },
    suggestionCard: {
      marginHorizontal: 16,
      marginVertical: 8,
      backgroundColor: theme.colors.primaryContainer,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    label: {
      marginBottom: 8,
      color: theme.colors.onSurfaceVariant,
      fontSize: 12,
    },
    questionText: {
      fontSize: 17,
      color: theme.colors.onSurface,
      marginBottom: 16,
      lineHeight: 24,
    },
    toggleRow: {
      marginBottom: 8,
    },
    answerInput: {
      minHeight: 100,
      padding: 12,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderRadius: 8,
      color: theme.colors.onSurface,
      fontSize: 16,
      textAlignVertical: 'top',
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    micButton: {
      marginRight: 4,
    },
    button: {
      marginLeft: 8,
    },
    error: {
      color: theme.colors.error,
      marginTop: 8,
      fontSize: 14,
    },
    followUpLabel: {
      fontSize: 12,
      color: theme.colors.onSurfaceVariant,
      marginBottom: 4,
    },
    followUpText: {
      fontSize: 15,
      color: theme.colors.onSurface,
      marginBottom: 12,
    },
    endSessionButton: {
      marginTop: 16,
      marginHorizontal: 16,
    },
    surveyInput: {
      padding: 12,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderRadius: 8,
      color: theme.colors.onSurface,
      fontSize: 16,
      marginBottom: 12,
    },
  });
