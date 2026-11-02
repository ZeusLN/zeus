import * as React from 'react';
import {
    AccessibilityInfo,
    LayoutChangeEvent,
    StyleSheet,
    View
} from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedProps,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import Svg, {
    Circle,
    Defs,
    Image as SvgImage,
    Mask,
    Rect
} from 'react-native-svg';
import { captureScreen, releaseCapture } from 'react-native-view-shot';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const REVEAL_DURATION = 600;
// Longest wait for the snapshot to draw before switching without it
export const SNAPSHOT_TIMEOUT = 1000;

export interface Point {
    x: number;
    y: number;
}

type Transition = (apply: () => Promise<void>, origin?: Point) => Promise<void>;

let host: Transition | null = null;

// Runs `apply` (a theme change) behind a snapshot of the screen, then
// reveals the new theme in a circle that grows from `origin` (screen
// coordinates, the center by default) until the snapshot is gone. Falls back
// to a plain switch when no host is mounted, Reduce Motion is on, or the
// screen can't be captured. Resolves once the transition has finished.
export function switchThemeWithTransition(
    apply: () => Promise<void>,
    origin?: Point
): Promise<void> {
    return host ? host(apply, origin) : apply();
}

// Distance from the origin to the farthest corner, so the circle ends up
// covering the whole screen
export function revealRadius(origin: Point, width: number, height: number) {
    return Math.max(
        Math.hypot(origin.x, origin.y),
        Math.hypot(width - origin.x, origin.y),
        Math.hypot(origin.x, height - origin.y),
        Math.hypot(width - origin.x, height - origin.y)
    );
}

const nextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

interface Snapshot {
    uri: string;
    origin: Point;
}

// Mounted once at the root of the app, above everything else
export default function ThemeTransitionHost() {
    const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
    const size = React.useRef({ width: 0, height: 0 });
    const onSnapshotLoad = React.useRef<(() => void) | null>(null);
    const onRevealEnd = React.useRef<(() => void) | null>(null);
    const radius = useSharedValue(0);

    const animatedProps = useAnimatedProps(() => ({ r: radius.value }));

    const revealEnded = React.useCallback(() => {
        onRevealEnd.current?.();
    }, []);

    React.useEffect(() => {
        const transition: Transition = async (apply, origin) => {
            const { width, height } = size.current;
            if (
                width === 0 ||
                (await AccessibilityInfo.isReduceMotionEnabled())
            ) {
                return apply();
            }

            let uri: string;
            try {
                uri = await captureScreen({
                    format: 'jpg',
                    quality: 0.9,
                    result: 'tmpfile'
                });
            } catch (e) {
                return apply();
            }

            const finish = () => {
                onSnapshotLoad.current = null;
                onRevealEnd.current = null;
                setSnapshot(null);
                releaseCapture(uri);
            };

            // The theme may only change once the snapshot covers the screen
            const shown = await new Promise<boolean>((resolve) => {
                const timeout = setTimeout(
                    () => resolve(false),
                    SNAPSHOT_TIMEOUT
                );
                onSnapshotLoad.current = () => {
                    clearTimeout(timeout);
                    resolve(true);
                };
                radius.value = 0;
                setSnapshot({
                    uri,
                    origin: origin || { x: width / 2, y: height / 2 }
                });
            });
            if (!shown) {
                finish();
                return apply();
            }

            try {
                await apply();
            } catch (e) {
                finish();
                throw e;
            }

            // Let the app render in the new theme before opening the circle
            await nextFrame();
            await nextFrame();

            await new Promise<void>((resolve) => {
                onRevealEnd.current = resolve;
                radius.value = withTiming(
                    revealRadius(
                        origin || { x: width / 2, y: height / 2 },
                        width,
                        height
                    ),
                    {
                        duration: REVEAL_DURATION,
                        easing: Easing.out(Easing.cubic)
                    },
                    () => {
                        runOnJS(revealEnded)();
                    }
                );
            });
            finish();
        };

        host = transition;
        return () => {
            if (host === transition) host = null;
        };
    }, [radius, revealEnded]);

    const onLayout = (event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        size.current = { width, height };
    };

    const { width, height } = size.current;

    return (
        <View
            style={styles.container}
            pointerEvents={snapshot ? 'auto' : 'none'}
            onLayout={onLayout}
            testID="theme-transition"
        >
            {snapshot && (
                <Svg width={width} height={height}>
                    <Defs>
                        <Mask id="themeTransitionReveal">
                            <Rect width={width} height={height} fill="white" />
                            <AnimatedCircle
                                cx={snapshot.origin.x}
                                cy={snapshot.origin.y}
                                fill="black"
                                animatedProps={animatedProps}
                            />
                        </Mask>
                    </Defs>
                    <SvgImage
                        href={{ uri: snapshot.uri }}
                        width={width}
                        height={height}
                        preserveAspectRatio="none"
                        mask="url(#themeTransitionReveal)"
                        onLoad={() => onSnapshotLoad.current?.()}
                    />
                </Svg>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
    }
});
