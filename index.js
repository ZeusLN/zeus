/**
 * @format
 * @lint-ignore-every XPLATJSCOPYRIGHT1
 */

// polyfills
import { TextDecoder } from 'text-encoding';
import 'react-native-get-random-values';
global.TextDecoder = TextDecoder;

import {AppRegistry} from 'react-native';
import 'react-native-gesture-handler';
import './shim.js'
import App from './App.tsx';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
