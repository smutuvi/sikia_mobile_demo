import {StyleSheet} from 'react-native';
import {MD3Theme} from 'react-native-paper';

export const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    contentContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    modelAuthor: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 10,
    },
    modelNameContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    modelName: {
      flex: 1,
      color: theme.colors.onSurface,
    },
    statsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
      marginBottom: 10,
      flexWrap: 'wrap',
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      color: theme.colors.onSurfaceVariant,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.outlineVariant,
      opacity: 0.6,
    },
    noResultsText: {
      marginTop: 16,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    emptyStateContainer: {
      marginTop: 16,
      alignItems: 'center',
      gap: 8,
    },
    errorText: {
      color: theme.colors.error,
      textAlign: 'center',
    },
    disableTokenButton: {
      marginTop: 12,
    },
    errorHintText: {
      marginTop: 4,
      textAlign: 'center',
      color: theme.colors.onSurfaceVariant,
    },
  });

