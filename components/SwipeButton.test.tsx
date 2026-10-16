import React from 'react';
import {
    Dimensions,
    PanResponder,
    PanResponderCallbacks,
    StyleSheet
} from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
    useFocusEffect: jest.fn()
}));
jest.mock('../assets/images/SVG/Caret Right alt.svg', () => 'CaretRight');
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: jest.fn((key: string) => `theme:${key}`)
}));

import SwipeButton from './SwipeButton';

let responder: PanResponderCallbacks;

beforeEach(() => {
    jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
        responder = config;
        return { panHandlers: {} } as any;
    });
});

afterEach(() => jest.restoreAllMocks());

const layout = (width: number) =>
    fireEvent(screen.root!, 'layout', {
        nativeEvent: { layout: { width, height: 50, x: 0, y: 0 } }
    });

const swipe = (dx: number) =>
    act(() => {
        responder.onPanResponderRelease!({} as any, { dx } as any);
    });

describe('SwipeButton', () => {
    // Send wraps the button in alignItems: 'center'. Without stretching, the
    // track shrinks to its label and a few points of drag would pay.
    it('stretches its track across a centering parent', async () => {
        await render(<SwipeButton onSwipeSuccess={jest.fn()} />);
        const style = StyleSheet.flatten(screen.root!.props.style);
        expect(style.alignSelf).toBe('stretch');
    });

    // A 300pt track leaves 250pt of travel for the 50pt knob, so a swipe
    // completes past 237.5pt.
    it('completes a swipe to the end of a track narrower than the window', async () => {
        expect(Dimensions.get('window').width - 40).toBeGreaterThan(300);
        const onSwipeSuccess = jest.fn();
        await render(<SwipeButton onSwipeSuccess={onSwipeSuccess} />);
        await layout(300);
        await swipe(240);
        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });

    it('does not complete a swipe that stops short of the end', async () => {
        const onSwipeSuccess = jest.fn();
        await render(<SwipeButton onSwipeSuccess={onSwipeSuccess} />);
        await layout(300);
        await swipe(230);
        expect(onSwipeSuccess).not.toHaveBeenCalled();
    });

    it('uses the new track length after a resize', async () => {
        const onSwipeSuccess = jest.fn();
        await render(<SwipeButton onSwipeSuccess={onSwipeSuccess} />);
        await layout(300);
        await layout(500);
        await swipe(240);
        expect(onSwipeSuccess).not.toHaveBeenCalled();
        await swipe(430);
        expect(onSwipeSuccess).toHaveBeenCalledTimes(1);
    });
});
