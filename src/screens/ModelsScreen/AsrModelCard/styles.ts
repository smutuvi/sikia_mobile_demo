import {StyleSheet} from 'react-native';
import {MD3Theme} from 'react-native-paper';

export const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      borderRadius: 14,
      padding: 12,
      marginBottom: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    titleCol: {
      flex: 1,
    },
    subtitle: {
      marginTop: 6,
      color: theme.colors.onSurfaceVariant,
    },
    actionsRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 10,
    },
    primaryActionButton: {
      borderRadius: 16,
      borderWidth: 1,
      height: 40,
    },
    progressText: {
      flex: 1,
      color: theme.colors.onSurfaceVariant,
    },
  });

