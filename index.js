/**
 * @format
 */

// Import URL polyfill for React Native/Hermes compatibility
import 'react-native-url-polyfill/auto';

import {AppRegistry, LogBox} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// Suppress all LogBox warnings in development (hides “Open debugger to view warnings” banner)
if (__DEV__) {
  LogBox.ignoreAllLogs(true);
}

AppRegistry.registerComponent(appName, () => App);
