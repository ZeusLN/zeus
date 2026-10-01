import { Platform } from 'react-native';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';

import { settingsStore } from '../stores/Stores';

// iOS only: the native tab bar and Liquid Glass styling, on unless the user
// turned it off in Display settings. Blobs saved before the setting existed
// have no value, which counts as on.
export const isLiquidGlassEnabled = (): boolean =>
    Platform.OS === 'ios' &&
    settingsStore.settings?.display?.liquidGlass !== false;

// Glass effect views additionally need iOS 26 and an Xcode 26 build
export const isGlassEffectEnabled = (): boolean =>
    isLiquidGlassSupported && isLiquidGlassEnabled();
