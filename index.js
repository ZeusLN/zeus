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
const TextEncodingPolyfill = require("text-encoding");
import Long from 'long';
import protobuf from 'protobufjs';

const applyGlobalPolyfills = () => {
  Object.assign(global, {
    TextEncoder: TextEncodingPolyfill.TextEncoder,
    TextDecoder: TextEncodingPolyfill.TextDecoder,
  });
};

applyGlobalPolyfills();

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

AppRegistry.registerComponent(appName, () => App);
