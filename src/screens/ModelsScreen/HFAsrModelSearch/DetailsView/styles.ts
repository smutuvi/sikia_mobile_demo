import {StyleSheet} from 'react-native';
import {MD3Theme} from 'react-native-paper';

export const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 10,
    },
    header: {
      marginBottom: 12,
    },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modelAuthor: {
      color: theme.colors.onSurfaceVariant,
    },
    titleContainer: {
      marginTop: 6,
    },
    modelTitle: {
      color: theme.colors.onSurface,
    },
    modelStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    stat: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    statText: {
      color: theme.colors.onSurfaceVariant,
    },
    sectionTitle: {
      marginTop: 14,
      marginBottom: 6,
      color: theme.colors.onSurface,
    },
    list: {
      paddingBottom: 120,
    },
  });

