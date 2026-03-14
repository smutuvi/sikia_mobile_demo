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
    description: {
      marginBottom: 16,
      color: theme.colors.onSurfaceVariant,
    },
    buttonContainer: {
      marginTop: 8,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    button: {
      marginLeft: 8,
    },
    transcriptField: {
      minHeight: 120,
      marginTop: 12,
      marginBottom: 16,
      padding: 12,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderRadius: 8,
      color: theme.colors.onSurface,
      fontSize: 16,
      textAlignVertical: 'top',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      gap: 8,
    },
    micButton: {
      marginRight: 8,
    },
    toggleRow: {
      marginTop: 12,
      marginBottom: 8,
    },
    activeModelLabel: {
      marginTop: 8,
      marginBottom: 4,
    },
  });
