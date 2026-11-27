import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import Screen from '../Screen';

import BalancePreview from './BalancePreview';
import ChannelsPreview from './ChannelsPreview';
import KeypadPreview from './KeypadPreview';
import ReceivePreview from './ReceivePreview';
import { BASE_HEIGHT, BASE_WIDTH, PREVIEW_ASPECT_RATIO } from './constants';
import { colorsFor } from './parts';

export { PREVIEW_ASPECT_RATIO };

export type ThemePreviewView = 'balance' | 'keypad' | 'channels' | 'receive';

export const THEME_PREVIEW_VIEWS: ThemePreviewView[] = [
    'balance',
    'keypad',
    'channels',
    'receive'
];

interface ThemePreviewProps {
    theme: string;
    view: ThemePreviewView;
    width: number;
}

// A scaled-down mock of one wallet screen drawn in the given theme's colors,
// whichever theme is selected. The mock is laid out at BASE_WIDTH and scaled
// to `width`, so text and spacing keep the real screens' proportions.
export default function ThemePreview({
    theme,
    view,
    width
}: ThemePreviewProps) {
    const color = colorsFor(theme);
    const scale = width / BASE_WIDTH;

    return (
        <View
            style={[
                styles.frame,
                {
                    width,
                    height: width * PREVIEW_ASPECT_RATIO,
                    borderRadius: 24 * scale,
                    borderColor: color('separator')
                }
            ]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
        >
            <View style={[styles.canvas, { transform: [{ scale }] }]}>
                <Screen theme={theme}>
                    {view === 'balance' && (
                        <BalancePreview theme={theme} color={color} />
                    )}
                    {view === 'keypad' && <KeypadPreview color={color} />}
                    {view === 'channels' && <ChannelsPreview color={color} />}
                    {view === 'receive' && <ReceivePreview color={color} />}
                </Screen>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    frame: {
        overflow: 'hidden',
        borderWidth: 1
    },
    canvas: {
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        transformOrigin: 'top left'
    }
});
