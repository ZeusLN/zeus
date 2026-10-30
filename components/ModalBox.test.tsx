jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));

import * as React from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ModalBox from './ModalBox';

const WINDOW_HEIGHT = 800;
const TOP_INSET = 50;

const SettingsStore: any = { loginRequired: () => false };

const mockWindow = (fontScale: number) =>
    jest.spyOn(Dimensions, 'get').mockReturnValue({
        width: 400,
        height: WINDOW_HEIGHT,
        scale: 2,
        fontScale
    });

const renderSheet = async (props: any, containerTop = 0) => {
    const ref = React.createRef<any>();
    await render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 400, height: WINDOW_HEIGHT },
                insets: { top: TOP_INSET, left: 0, right: 0, bottom: 0 }
            }}
        >
            <ModalBox
                ref={ref}
                SettingsStore={SettingsStore}
                startOpen
                {...props}
            >
                <Text testID="sheet-content">content</Text>
            </ModalBox>
        </SafeAreaProvider>
    );
    // Where the container starts in the window
    ref.current.containerRef = {
        current: {
            measureInWindow: (cb: (...args: number[]) => void) =>
                cb(0, containerTop, 400, WINDOW_HEIGHT - containerTop)
        }
    };
    // The container measures the area the sheet is positioned in
    const container = screen.getByTestId('sheet-content').parent!.parent!;
    await act(async () => {
        fireEvent(container, 'layout', {
            nativeEvent: { layout: { width: 400, height: WINDOW_HEIGHT } }
        });
    });
};

const sheetHeight = () =>
    StyleSheet.flatten(screen.getByTestId('sheet-content').parent!.props.style)
        .height;

// The open animation is scheduled with requestAnimationFrame; fake timers keep
// it from firing after the test environment is torn down
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe('ModalBox sheet height', () => {
    it('scales the requested height by fontScale when it fits', async () => {
        mockWindow(1.15);
        await renderSheet({ position: 'bottom', style: { height: 400 } });
        expect(sheetHeight()).toBeCloseTo(460);
    });

    it('keeps a bottom sheet below the top inset when the scaled height overflows', async () => {
        mockWindow(1.3);
        await renderSheet({
            position: 'bottom',
            style: { height: WINDOW_HEIGHT * 0.9 }
        });
        expect(sheetHeight()).toBe(WINDOW_HEIGHT - TOP_INSET);
    });

    it('keeps a bottom sheet below the top inset at the default font scale', async () => {
        mockWindow(1);
        await renderSheet({ position: 'bottom', style: { height: 2000 } });
        expect(sheetHeight()).toBe(WINDOW_HEIGHT - TOP_INSET);
    });

    it('only subtracts the part of the inset the container overlaps', async () => {
        mockWindow(1.3);
        await renderSheet(
            { position: 'bottom', style: { height: WINDOW_HEIGHT } },
            30
        );
        expect(sheetHeight()).toBe(WINDOW_HEIGHT - (TOP_INSET - 30));
    });

    it('does not subtract the inset when the container starts below it', async () => {
        mockWindow(1.3);
        await renderSheet(
            { position: 'bottom', style: { height: WINDOW_HEIGHT } },
            120
        );
        expect(sheetHeight()).toBe(WINDOW_HEIGHT);
    });

    it('clamps a centered sheet to the full container', async () => {
        mockWindow(1.3);
        await renderSheet({ position: 'center', style: { height: 700 } });
        expect(sheetHeight()).toBe(WINDOW_HEIGHT);
    });
});
