jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));

import * as React from 'react';
import { Animated, Dimensions, StyleSheet, Text } from 'react-native';
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

type MeasureInWindow = (cb: (...args: number[]) => void) => void;

const renderSheet = async (
    props: any,
    containerTop: number | MeasureInWindow = 0
) => {
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
            measureInWindow:
                typeof containerTop === 'function'
                    ? containerTop
                    : (cb: (...args: number[]) => void) =>
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
    return ref;
};

const sheet = () => screen.getByTestId('sheet-content').parent!;

const sheetHeight = () => StyleSheet.flatten(sheet().props.style).height;

// Report the sheet's rendered height, as the native layout pass would
const layoutSheet = async () => {
    await act(async () => {
        fireEvent(sheet(), 'layout', {
            nativeEvent: { layout: { width: 400, height: sheetHeight() } }
        });
    });
};

// Run the requestAnimationFrame in animateOpen that computes the position
const flushOpen = async () => {
    await act(async () => {
        jest.runOnlyPendingTimers();
    });
};

// The offset the last open animation moved the sheet to
const lastPositionDest = (
    ref: React.RefObject<any>,
    timing: jest.SpyInstance
) =>
    timing.mock.calls
        .filter(([value]) => value === ref.current.state.position)
        .map(([, config]) => config.toValue)
        .pop();

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

describe('ModalBox keyboard position', () => {
    const KEYBOARD_TOP = 500;

    const openKeyboard = async (ref: React.RefObject<any>) => {
        await act(async () => {
            ref.current.onKeyboardChange({
                endCoordinates: { screenY: KEYBOARD_TOP }
            });
        });
        await flushOpen();
    };

    it('keeps a bottom sheet below the top inset when the keyboard pushes it up', async () => {
        mockWindow(1);
        const timing = jest.spyOn(Animated, 'timing');
        const ref = await renderSheet({
            position: 'bottom',
            style: { height: WINDOW_HEIGHT * 0.9 }
        });
        await layoutSheet();
        await openKeyboard(ref);
        // keyboardTopOffset alone (22 on iOS) would put the top under the inset
        expect(lastPositionDest(ref, timing)).toBe(TOP_INSET);
    });

    it('sits a bottom sheet on the keyboard when it fits above it', async () => {
        mockWindow(1);
        const timing = jest.spyOn(Animated, 'timing');
        const ref = await renderSheet({
            position: 'bottom',
            style: { height: 200 }
        });
        await layoutSheet();
        await openKeyboard(ref);
        expect(lastPositionDest(ref, timing)).toBe(KEYBOARD_TOP - 200);
    });
});

describe('ModalBox late container measurement', () => {
    it('repositions an open sheet when the container turns out to start below the inset', async () => {
        mockWindow(1.3);
        const timing = jest.spyOn(Animated, 'timing');
        let reportTop: (y: number) => void = () => {};
        const ref = await renderSheet(
            { position: 'bottom', style: { height: WINDOW_HEIGHT } },
            (cb) => {
                reportTop = (y) => cb(0, y, 400, WINDOW_HEIGHT - y);
            }
        );
        // Opened before measureInWindow answers: the full inset is given up
        await layoutSheet();
        await flushOpen();
        expect(sheetHeight()).toBe(WINDOW_HEIGHT - TOP_INSET);
        expect(lastPositionDest(ref, timing)).toBe(TOP_INSET);

        // The container starts below the inset, so the sheet grows to fill it
        // and has to move back up to stay inside it
        await act(async () => reportTop(120));
        expect(sheetHeight()).toBe(WINDOW_HEIGHT);
        await layoutSheet();
        await flushOpen();
        expect(lastPositionDest(ref, timing)).toBe(0);
    });
});
