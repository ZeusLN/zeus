// The package's iOS entry needs its native module, which Jest doesn't have.
// Mirror the package's own non-iOS fallbacks.
import { View } from 'react-native';

export const isLiquidGlassSupported = false;
export const LiquidGlassView = View;
export const LiquidGlassContainerView = View;
