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
import {
    Animated,
    Dimensions,
    PanResponder,
    Platform,
    StyleSheet
} from 'react-native';
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
const canTakeOverDrag = () => responderConfig.onMoveShouldSetPanResponder();

// how far the knob is drawn from the start of the track
const knobOffset = () => {
    const { transform } = StyleSheet.flatten(
        screen.getByTestId('swipe-button-knob').props.style
    );
    return transform[0].translateX;
};

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

    it('only takes over a drag once measured, enabled and not completed', async () => {
        await renderButton();
        expect(canTakeOverDrag()).toBe(false);

        await layoutTrack(TRACK_WIDTH);
        expect(canTakeOverDrag()).toBe(true);

        await swipe(240);
        expect(canTakeOverDrag()).toBe(false);
    });

    it('does not take over a drag while disabled', async () => {
        await renderButton({ disabled: true });
        await layoutTrack(TRACK_WIDTH);

        expect(canTakeOverDrag()).toBe(false);
    });

    it('accepts a touch as soon as the track is laid out', async () => {
        await renderButton();
        const event = {
            nativeEvent: {
                layout: { x: 0, y: 0, width: TRACK_WIDTH, height: 50 }
            }
        };
        let accepted: boolean | undefined;
        await act(async () => {
            screen.getByTestId('swipe-button-track').props.onLayout(event);
            // before React re-renders with the new width
            accepted = canStartDrag();
        });

        expect(accepted).toBe(true);
    });

    it('keeps a completed knob at the end of a resized track', async () => {
        await renderButton();
        await layoutTrack(TRACK_WIDTH);
        await swipe(240);
        expect(knobOffset()).toBe(250);

        await layoutTrack(200);

        expect(knobOffset()).toBe(150);
    });

    it('clamps the knob to the ends of the track during a drag', async () => {
        await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 400 });
        });
        expect(knobOffset()).toBe(250);

        await act(async () => {
            responderConfig.onPanResponderMove({}, { dx: -30 });
        });
        expect(knobOffset()).toBe(0);
    });

    it('springs back when another responder takes the drag', async () => {
        const spring = jest.spyOn(Animated, 'spring');
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 100 });
            responderConfig.onPanResponderTerminate();
        });

        expect(spring).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ toValue: 0 })
        );
        expect(onSwipeSuccess).not.toHaveBeenCalled();
    });

    it('stays at the end when the drag is taken after a completed swipe', async () => {
        const spring = jest.spyOn(Animated, 'spring');
        await renderButton();
        await layoutTrack(TRACK_WIDTH);
        await swipe(240);

        await act(async () => responderConfig.onPanResponderTerminate());

        expect(spring).not.toHaveBeenCalled();
        expect(knobOffset()).toBe(250);
    });

    it('cannot be swiped on a track no wider than the knob', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(50);

        expect(canStartDrag()).toBe(false);
        expect(canTakeOverDrag()).toBe(false);
        await swipe(50);

        expect(onSwipeSuccess).not.toHaveBeenCalled();
    });

    it('cancels a drag when the track narrows under it', async () => {
        const spring = jest.spyOn(Animated, 'spring');
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 200 });
        });
        // 200 is 80% of the 250 travel the drag started on, but past 95%
        // of the 150 travel left after the resize
        await layoutTrack(200);
        expect(spring).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ toValue: 0 })
        );
        await act(async () => {
            responderConfig.onPanResponderMove({}, { dx: 200 });
            responderConfig.onPanResponderRelease({}, { dx: 200 });
        });

        expect(onSwipeSuccess).not.toHaveBeenCalled();
        expect(canStartDrag()).toBe(true);
    });

    it('cancels a drag when the track widens under it', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(200);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 150 });
        });
        await layoutTrack(TRACK_WIDTH);
        await act(async () => {
            responderConfig.onPanResponderMove({}, { dx: 250 });
            responderConfig.onPanResponderRelease({}, { dx: 250 });
        });

        expect(onSwipeSuccess).not.toHaveBeenCalled();
    });

    it('completes a new drag on the resized track', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 200 });
        });
        await layoutTrack(200);
        await act(async () => {
            responderConfig.onPanResponderRelease({}, { dx: 200 });
        });
        await swipe(145);

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });

    it('keeps a drag through a layout pass that leaves the width unchanged', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 200 });
        });
        await layoutTrack(TRACK_WIDTH);
        await act(async () => {
            responderConfig.onPanResponderMove({}, { dx: 240 });
            responderConfig.onPanResponderRelease({}, { dx: 240 });
        });

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });

    // A screen reader cannot drag the knob. The track is a button, and its
    // activate action (a double tap in TalkBack) completes it.
    const activate = (actionName = 'activate') =>
        act(async () => {
            fireEvent(
                screen.getByTestId('swipe-button-track'),
                'accessibilityAction',
                { nativeEvent: { actionName } }
            );
        });

    it('is a button named by its instruction text, with an activate action', async () => {
        jest.replaceProperty(Platform, 'OS', 'android');
        await renderButton();

        const track = screen.getByRole('button', { name: 'Slide to Pay' });
        expect(track).toBe(screen.getByTestId('swipe-button-track'));
        // the name would also come from the text inside; set it on the
        // track so it does not depend on the children
        expect(track.props.accessibilityLabel).toBe('Slide to Pay');
        expect(track.props.accessibilityActions).toEqual([
            { name: 'activate' }
        ]);
        expect(track.props.accessibilityState).toEqual({ disabled: false });
    });

    it('completes from the activate action the way a full swipe does', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await activate();

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
        expect(knobOffset()).toBe(250);
        expect(canStartDrag()).toBe(false);
    });

    it('does nothing on the activate action while disabled', async () => {
        const onSwipeSuccess = await renderButton({ disabled: true });
        await layoutTrack(TRACK_WIDTH);

        expect(
            screen.getByTestId('swipe-button-track').props.accessibilityState
        ).toEqual({ disabled: true });
        await activate();

        expect(onSwipeSuccess).not.toHaveBeenCalled();
        expect(knobOffset()).toBe(0);
    });

    it('does not pay twice from two activate actions', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await activate();
        await activate();

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });

    it('can be activated again once the screen regains focus', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);
        await activate();

        await act(async () => mockFocusEffect!());
        await activate();

        expect(onSwipeSuccess).toHaveBeenCalledTimes(2);
    });

    it('reports a completed button as disabled until the screen regains focus', async () => {
        await renderButton();
        await layoutTrack(TRACK_WIDTH);
        const track = () => screen.getByTestId('swipe-button-track');

        await activate();
        expect(track().props.accessibilityState).toEqual({ disabled: true });
        // only the screen reader hears it: the track does not fade
        expect(StyleSheet.flatten(track().props.style).opacity).toBeUndefined();

        await act(async () => mockFocusEffect!());
        expect(track().props.accessibilityState).toEqual({ disabled: false });

        await swipe(240);
        expect(track().props.accessibilityState).toEqual({ disabled: true });
    });

    it('ignores other accessibility actions', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await activate('longpress');

        expect(onSwipeSuccess).not.toHaveBeenCalled();
    });

    it('completes from the activate action before the track is measured', async () => {
        const onSwipeSuccess = await renderButton();

        await activate();
        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);

        // the locked knob goes to the end once the track is measured
        await layoutTrack(TRACK_WIDTH);
        expect(knobOffset()).toBe(250);
    });

    it('ignores the activate action during a drag', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 100 });
        });
        await activate();
        expect(onSwipeSuccess).not.toHaveBeenCalled();

        await act(async () => {
            responderConfig.onPanResponderRelease({}, { dx: 100 });
        });
        await activate();
        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });

    it('ignores the activate action on a drag cancelled by a resize', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 200 });
        });
        // the finger is still down on a track of another width
        await layoutTrack(200);
        await activate();
        expect(onSwipeSuccess).not.toHaveBeenCalled();

        // the release springs the knob back; then the action works and
        // locks the knob at the end of the resized track
        await act(async () => {
            responderConfig.onPanResponderRelease({}, { dx: 200 });
        });
        await activate();
        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
        expect(knobOffset()).toBe(150);
    });

    it('does nothing on the activate action once disabled after mount', async () => {
        const onSwipeSuccess = jest.fn();
        await render(
            <SwipeButton
                onSwipeSuccess={onSwipeSuccess}
                instructionText="Slide to Pay"
            />
        );
        await layoutTrack(TRACK_WIDTH);

        // e.g. TransactionsStore.paymentInFlight turns on
        await screen.rerender(
            <SwipeButton
                onSwipeSuccess={onSwipeSuccess}
                instructionText="Slide to Pay"
                disabled
            />
        );
        await activate();

        expect(onSwipeSuccess).not.toHaveBeenCalled();
        expect(
            screen.getByTestId('swipe-button-track').props.accessibilityState
        ).toEqual({ disabled: true });
    });

    it('keeps the untranslated activate action out of the iOS actions rotor', async () => {
        jest.replaceProperty(Platform, 'OS', 'ios');
        await renderButton();

        const track = screen.getByRole('button', { name: 'Slide to Pay' });
        expect(track.props.accessibilityActions).toBeUndefined();
        expect(typeof track.props.onAccessibilityTap).toBe('function');
    });

    // VoiceOver on the New Architecture: a double tap fires
    // onAccessibilityTap, not the activate action
    const tap = () =>
        act(async () => {
            fireEvent(
                screen.getByTestId('swipe-button-track'),
                'accessibilityTap'
            );
        });

    it('completes from a VoiceOver double tap the way a full swipe does', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await tap();

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
        expect(knobOffset()).toBe(250);
        expect(canStartDrag()).toBe(false);
    });

    it('does nothing on a VoiceOver double tap while disabled', async () => {
        const onSwipeSuccess = await renderButton({ disabled: true });
        await layoutTrack(TRACK_WIDTH);

        await tap();

        expect(onSwipeSuccess).not.toHaveBeenCalled();
    });

    it('does not pay twice from two VoiceOver double taps', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await tap();
        await tap();

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });

    it('pays once for two double taps before a re-render', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);
        const { onAccessibilityAction, onAccessibilityTap } =
            screen.getByTestId('swipe-button-track').props;

        await act(async () => {
            const event = { nativeEvent: { actionName: 'activate' } };
            onAccessibilityAction(event);
            onAccessibilityAction(event);
            onAccessibilityTap();
        });

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });

    it('ignores a VoiceOver double tap during a drag', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 100 });
        });
        await tap();

        expect(onSwipeSuccess).not.toHaveBeenCalled();
    });

    it('can be activated after another responder takes the drag', async () => {
        const onSwipeSuccess = await renderButton();
        await layoutTrack(TRACK_WIDTH);

        await act(async () => {
            responderConfig.onPanResponderGrant();
            responderConfig.onPanResponderMove({}, { dx: 100 });
            responderConfig.onPanResponderTerminate();
        });
        await activate();

        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
        expect(knobOffset()).toBe(250);
    });
});
