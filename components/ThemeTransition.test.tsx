// Finishes every animation at once, like Reanimated's own mock
jest.mock('react-native-reanimated', () => ({
    __esModule: true,
    default: { createAnimatedComponent: (component: any) => component },
    Easing: { out: () => () => 0, cubic: () => 0 },
    runOnJS: (fn: any) => fn,
    useSharedValue: (value: any) => require('react').useRef({ value }).current,
    useAnimatedProps: (updater: () => any) => updater(),
    withTiming: (toValue: number, _config: any, callback?: any) => {
        callback?.(true);
        return toValue;
    }
}));
jest.mock('react-native-view-shot', () => ({
    captureScreen: jest.fn(),
    releaseCapture: jest.fn()
}));
jest.mock('react-native-svg', () => {
    const { View } = require('react-native');
    const element = (name: string) => (props: any) =>
        <View testID={`svg-${name}`} {...props} />;
    return {
        __esModule: true,
        default: element('root'),
        Circle: element('circle'),
        Defs: element('defs'),
        Image: element('image'),
        Mask: element('mask'),
        Rect: element('rect')
    };
});

import * as React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { captureScreen, releaseCapture } from 'react-native-view-shot';

import ThemeTransitionHost, {
    revealRadius,
    SNAPSHOT_TIMEOUT,
    switchThemeWithTransition
} from './ThemeTransition';

const SNAPSHOT = 'file:///tmp/snapshot.jpg';

const mountHost = async () => {
    await render(<ThemeTransitionHost />);
    await fireEvent(screen.getByTestId('theme-transition'), 'layout', {
        nativeEvent: { layout: { width: 300, height: 400 } }
    });
};

// Lets pending promise callbacks run
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe('revealRadius', () => {
    it('reaches the farthest corner', () => {
        expect(revealRadius({ x: 0, y: 0 }, 300, 400)).toBe(500);
        expect(revealRadius({ x: 300, y: 400 }, 300, 400)).toBe(500);
        expect(revealRadius({ x: 150, y: 200 }, 300, 400)).toBe(250);
    });
});

describe('switchThemeWithTransition', () => {
    let reduceMotion: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        (captureScreen as jest.Mock).mockResolvedValue(SNAPSHOT);
        reduceMotion = jest
            .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
            .mockResolvedValue(false);
    });

    it('switches directly when no host is mounted', async () => {
        const apply = jest.fn(async () => {});
        await switchThemeWithTransition(apply);
        expect(apply).toHaveBeenCalledTimes(1);
        expect(captureScreen).not.toHaveBeenCalled();
    });

    it('switches directly when Reduce Motion is on', async () => {
        await mountHost();
        reduceMotion.mockResolvedValue(true);
        const apply = jest.fn(async () => {});
        await act(() => switchThemeWithTransition(apply));
        expect(apply).toHaveBeenCalledTimes(1);
        expect(captureScreen).not.toHaveBeenCalled();
    });

    it('switches directly when the screen cannot be captured', async () => {
        await mountHost();
        (captureScreen as jest.Mock).mockRejectedValue(new Error('no window'));
        const apply = jest.fn(async () => {});
        await act(() => switchThemeWithTransition(apply));
        expect(apply).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('svg-image')).toBeNull();
    });

    it('changes the theme only after the snapshot is on screen', async () => {
        await mountHost();
        const calls: string[] = [];
        const apply = jest.fn(async () => {
            calls.push('apply');
        });

        let done = false;
        const transition = switchThemeWithTransition(apply, {
            x: 120,
            y: 380
        }).then(() => {
            done = true;
        });
        await flush();

        const image = screen.getByTestId('svg-image');
        expect(image).toHaveProp('href', { uri: SNAPSHOT });
        expect(apply).not.toHaveBeenCalled();

        await act(() => image.props.onLoad());
        await act(() => transition);

        expect(apply).toHaveBeenCalledTimes(1);
        expect(done).toBe(true);
        expect(screen.queryByTestId('svg-image')).toBeNull();
        expect(releaseCapture).toHaveBeenCalledWith(SNAPSHOT);
        expect(captureScreen).toHaveBeenCalledWith(
            expect.objectContaining({ result: 'tmpfile' })
        );
    });

    it('opens the circle from the given point, or the center', async () => {
        await mountHost();
        const apply = jest.fn(async () => {});

        let transition = switchThemeWithTransition(apply, { x: 120, y: 380 });
        await flush();
        let circle = screen.getByTestId('svg-circle');
        expect(circle).toHaveProp('cx', 120);
        expect(circle).toHaveProp('cy', 380);
        await act(() => screen.getByTestId('svg-image').props.onLoad());
        await act(() => transition);

        transition = switchThemeWithTransition(apply);
        await flush();
        circle = screen.getByTestId('svg-circle');
        expect(circle).toHaveProp('cx', 150);
        expect(circle).toHaveProp('cy', 200);
        await act(() => screen.getByTestId('svg-image').props.onLoad());
        await act(() => transition);
    });

    it('blocks touches only while the snapshot is up', async () => {
        await mountHost();
        const host = screen.getByTestId('theme-transition');
        expect(host).toHaveProp('pointerEvents', 'none');

        const transition = switchThemeWithTransition(jest.fn(async () => {}));
        await flush();
        expect(screen.getByTestId('theme-transition')).toHaveProp(
            'pointerEvents',
            'auto'
        );
        await act(() => screen.getByTestId('svg-image').props.onLoad());
        await act(() => transition);
        expect(screen.getByTestId('theme-transition')).toHaveProp(
            'pointerEvents',
            'none'
        );
    });

    it('switches without the snapshot if it never loads', async () => {
        await mountHost();
        jest.useFakeTimers();
        try {
            const apply = jest.fn(async () => {});
            const transition = switchThemeWithTransition(apply);
            await act(() => jest.advanceTimersByTimeAsync(SNAPSHOT_TIMEOUT));
            await act(() => transition);
            expect(apply).toHaveBeenCalledTimes(1);
            expect(screen.queryByTestId('svg-image')).toBeNull();
            expect(releaseCapture).toHaveBeenCalledWith(SNAPSHOT);
        } finally {
            jest.useRealTimers();
        }
    });

    it('removes the snapshot and rethrows when the switch fails', async () => {
        await mountHost();
        const apply = jest.fn(async () => {
            throw new Error('keychain write failed');
        });
        const transition = switchThemeWithTransition(apply);
        await flush();
        // Catch before the load triggers the failure, so act doesn't see an
        // unhandled rejection
        let error: Error | undefined;
        const settled = transition.catch((e: Error) => {
            error = e;
        });
        await act(() => screen.getByTestId('svg-image').props.onLoad());
        await settled;
        expect(error?.message).toBe('keychain write failed');
        await flush();
        expect(screen.queryByTestId('svg-image')).toBeNull();
        expect(releaseCapture).toHaveBeenCalledWith(SNAPSHOT);
    });
});
