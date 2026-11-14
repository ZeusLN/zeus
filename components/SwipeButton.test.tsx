jest.mock('../assets/images/SVG/Caret Right alt.svg', () => 'CaretRight');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
let mockFocusEffect: (() => void) | undefined;
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void) => {
        mockFocusEffect = effect;
    }
}));

import * as React from 'react';
import { Dimensions, PanResponder, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import SwipeButton from './SwipeButton';

// A track narrower than the window less the default margins, as when a
// parent pads the sides or centers its children. The knob is 50 wide, so
// the knob can travel 250 and a swipe completes past 0.95 * 250 = 237.5.
const WINDOW_WIDTH = 400;
const TRACK_WIDTH = 300;

let responderConfig: any;

const renderButton = async (props: any = {}) => {
    const onSwipeSuccess = jest.fn();
    responderConfig = undefined;
    await render(
        <SwipeButton
            onSwipeSuccess={onSwipeSuccess}
            instructionText="Slide to Pay"
            {...props}
        />
    );
    return onSwipeSuccess;
};

const layoutTrack = async (width: number) => {
    await act(async () => {
        fireEvent(screen.getByTestId('swipe-button-track'), 'layout', {
            nativeEvent: { layout: { x: 0, y: 0, width, height: 50 } }
        });
    });
};

const canStartDrag = () => responderConfig.onStartShouldSetPanResponder();

const swipe = (dx: number) =>
    act(async () => {
        responderConfig.onPanResponderGrant();
        responderConfig.onPanResponderMove({}, { dx });
        responderConfig.onPanResponderRelease({}, { dx });
    });

describe('SwipeButton', () => {
    beforeEach(() => {
        mockFocusEffect = undefined;
        jest.spyOn(Dimensions, 'get').mockReturnValue({
            width: WINDOW_WIDTH,
            height: 800,
            scale: 2,
            fontScale: 1
        });
        // The button builds its responder on the first render and keeps it
        const create = PanResponder.create;
        jest.spyOn(PanResponder, 'create').mockImplementation((config: any) => {
            if (!responderConfig) responderConfig = config;
            return create(config);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('stretches the track to the width of a parent that centers its children', async () => {
        await renderButton();
        const style = StyleSheet.flatten(
            screen.getByTestId('swipe-button-track').props.style
        );
        expect(style.alignSelf).toBe('stretch');
    });

    it('completes a swipe to the end of the measured track', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        expect(canStartDrag()).toBe(true);
        await swipe(240);

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });

    it('springs back from a swipe short of 95% of the measured track', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await swipe(230);

        expect(onSwipeSuccess).not.toHaveBeenCalled();
        expect(canStartDrag()).toBe(true);
    });

    it('completes on a track collapsed to its text', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(90);

        await swipe(39);

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });

    it('cannot be swiped before the track is measured', async () => {
        const onSwipeSuccess = await renderButton();

        expect(canStartDrag()).toBe(false);
        await swipe(WINDOW_WIDTH);

        expect(onSwipeSuccess).not.toHaveBeenCalled();
    });

    it('cannot be swiped while disabled', async () => {
        const onSwipeSuccess = await renderButton({ disabled: true });
        await layoutTrack(TRACK_WIDTH);

        expect(canStartDrag()).toBe(false);
        await swipe(240);

        expect(onSwipeSuccess).not.toHaveBeenCalled();
    });

    it('locks after a completed swipe until the screen regains focus', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await swipe(240);
        expect(canStartDrag()).toBe(false);

        await act(async () => mockFocusEffect!());
        expect(canStartDrag()).toBe(true);
        await swipe(240);

        expect(onSwipeSuccess).toHaveBeenCalledTimes(2);
    });
});
