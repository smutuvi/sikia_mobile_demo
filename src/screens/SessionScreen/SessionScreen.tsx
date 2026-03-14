import React from 'react';
import {SessionNavigator} from '../SessionScreens';

/**
 * Session entry point: renders the Flutter-style Session stack
 * (SessionList → NewSession → QuestionList → Interview → SessionReview).
 * Kept for backwards compatibility; App drawer uses SessionNavigator directly.
 */
export const SessionScreen: React.FC = () => {
  return <SessionNavigator />;
};
