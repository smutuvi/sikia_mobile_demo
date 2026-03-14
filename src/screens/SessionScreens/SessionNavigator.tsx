import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';

import type {FormItem} from '../../types/project';
import {HeaderLeft} from '../../components';
import {SessionListScreen} from './SessionListScreen';
import {ProjectsScreen} from './ProjectsScreen';
import {FormsScreen} from './FormsScreen';
import {FormFillScreen} from './FormFillScreen';
import {QuestionListScreen} from './QuestionListScreen';
import {InterviewScreen} from './InterviewScreen';
import {SessionReviewScreen} from './SessionReviewScreen';

export type SessionStackParamList = {
  Projects: undefined;
  Forms: {projectId: string; projectName?: string};
  FormFill: {form: FormItem};
  SessionList: undefined;
  QuestionList: {sessionId: string};
  Interview: {
    sessionId: string;
    questionId: string;
    formId?: string;
    targetFieldId?: string;
  };
  SessionReview: {sessionId: string};
};

const Stack = createStackNavigator<SessionStackParamList>();

export const SessionNavigator: React.FC = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: true,
      headerLeft: () => <HeaderLeft />,
    }}
    initialRouteName="Projects">
    <Stack.Screen
      name="Projects"
      component={ProjectsScreen}
      options={{title: 'Projects'}}
    />
    <Stack.Screen
      name="Forms"
      component={FormsScreen}
      options={({route}) => ({
        title: route.params.projectName ?? 'Forms',
        headerBackTitle: 'Projects',
      })}
    />
    <Stack.Screen
      name="FormFill"
      component={FormFillScreen}
      options={({route}) => ({
        title: route.params?.form?.title ?? 'Form',
        headerBackTitle: 'Forms',
      })}
    />
    <Stack.Screen
      name="SessionList"
      component={SessionListScreen}
      options={{title: 'Sessions'}}
    />
    <Stack.Screen
      name="QuestionList"
      component={QuestionListScreen}
      options={{
        title: 'Questions',
        headerBackTitle: 'Sessions',
      }}
    />
    <Stack.Screen
      name="Interview"
      component={InterviewScreen}
      options={{
        title: 'Interview',
        headerBackTitle: 'Questions',
      }}
    />
    <Stack.Screen
      name="SessionReview"
      component={SessionReviewScreen}
      options={{
        title: 'Review',
        headerBackTitle: 'Sessions',
      }}
    />
  </Stack.Navigator>
);
