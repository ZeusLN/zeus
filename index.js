// First import so t0 approximates JS start; uses no polyfilled globals
import {markStartupPhase} from './utils/StartupTimingUtils';
import './polyfills';
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens();

/**
 * @format
 * @lint-ignore-every XPLATJSCOPYRIGHT1
 */

// polyfills
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import 'message-port-polyfill';
import Long from 'long';
import protobuf from 'protobufjs';

protobuf.util.Long = Long;
protobuf.configure();

import {AppRegistry, LogBox} from 'react-native';
import './shim.js';
import App from './App.tsx';
import {name as appName} from './app.json';

// Suppress red screen for known ldk-node async errors that surface as unhandled
// rejections from the native runtime (these are handled via AlertStore instead)
LogBox.ignoreLogs([
  'FeerateEstimationUpdateTimeout',
  'Updating fee rate estimates timed out',
  'NodeException'
]);

// All top-level imports (including the full App screen graph and store
// singleton construction) have evaluated by the time this line runs
markStartupPhase('bundleEvaluated');

AppRegistry.registerComponent(appName, () => App);
