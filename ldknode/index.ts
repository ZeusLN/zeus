/**
 * LDK Node Module for React Native
 */

import { NativeModules } from 'react-native';
import LdkNodeInjection from './LdkNodeInjection';
import type { ILdkNodeInjections } from './LdkNodeInjection';

// Re-export all types
export * from './LdkNode.d';

// Export the injection interface type
export type { ILdkNodeInjections };

// Export the native module directly
export const LdkNodeModule = NativeModules.LdkNodeModule;

// Export the injection wrapper (recommended for use)
export { LdkNodeInjection };

// Default export is the injection wrapper
export default LdkNodeInjection;
