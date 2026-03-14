import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      padding: 16,
      paddingBottom: 24,
    },
    card: {
      marginBottom: 8,
      backgroundColor: theme.colors.surface,
    },
    emptyCard: {
      padding: 24,
      alignItems: 'center',
    },
    emptyIcon: {
      marginBottom: 12,
    },
    title: {
      marginBottom: 12,
    },
    input: {
      marginBottom: 12,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.colors.onSurface,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bubbleLeft: {
      alignSelf: 'flex-start',
      maxWidth: '85%',
      marginVertical: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 16,
    },
    bubbleRight: {
      alignSelf: 'flex-end',
      maxWidth: '85%',
      marginVertical: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 4,
    },
    thinkingBubble: {
      alignSelf: 'flex-start',
      maxWidth: '60%',
      marginVertical: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 16,
    },
    answerInput: {
      minHeight: 80,
      padding: 12,
      backgroundColor: theme.colors.surfaceContainerHighest,
      borderRadius: 8,
      color: theme.colors.onSurface,
      fontSize: 16,
      textAlignVertical: 'top',
    },
    error: {
      color: theme.colors.error,
      marginTop: 8,
      fontSize: 14,
    },
  });
