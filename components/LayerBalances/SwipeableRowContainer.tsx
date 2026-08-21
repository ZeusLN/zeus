import * as React from 'react';
import { Animated, StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

interface SwipeableRowContainerProps {
    children: React.ReactNode;
    renderLeftActions: (
        progress: Animated.AnimatedInterpolation<number>,
        close: () => void
    ) => React.ReactNode;
    onPress: (open: () => void) => void;
    containerStyle?: StyleProp<ViewStyle>;
    touchableStyle?: StyleProp<ViewStyle>;
}

interface SwipeableRowContainerState {
    expanded: boolean;
}

/**
 * Shell for the swipeable wallet rows: gesture configuration, open/closed
 * state and the accessibility wiring that belongs with it. A row says what
 * to reveal and what a tap should do; `open` and `close` are handed back so
 * the row can drive itself from a tap or from one of its own actions.
 *
 * The state follows onSwipeableWillOpen/WillClose rather than
 * onSwipeableOpen/onSwipeableClose: those two only fire once the spring
 * animation reports finished, so an interrupted swipe would leave the
 * announced state stale.
 */
export default class SwipeableRowContainer extends React.Component<
    SwipeableRowContainerProps,
    SwipeableRowContainerState
> {
    state = { expanded: false };

    private swipeableRow?: Swipeable;

    private updateRef = (ref: Swipeable) => {
        this.swipeableRow = ref;
    };

    private close = () => {
        this.swipeableRow?.close();
    };

    private open = () => {
        this.swipeableRow?.openLeft();
    };

    render() {
        const {
            children,
            renderLeftActions,
            onPress,
            containerStyle,
            touchableStyle
        } = this.props;
        const { expanded } = this.state;

        return (
            <Swipeable
                ref={this.updateRef}
                friction={2}
                enableTrackpadTwoFingerGesture
                leftThreshold={30}
                rightThreshold={40}
                renderLeftActions={(progress) =>
                    renderLeftActions(progress, this.close)
                }
                containerStyle={containerStyle}
                onSwipeableWillOpen={() => this.setState({ expanded: true })}
                onSwipeableWillClose={() => this.setState({ expanded: false })}
            >
                <TouchableOpacity
                    onPress={() => onPress(this.open)}
                    activeOpacity={1}
                    style={touchableStyle}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityActions={[
                        { name: 'expand' },
                        { name: 'collapse' }
                    ]}
                    onAccessibilityAction={({
                        nativeEvent: { actionName }
                    }) => {
                        if (actionName === 'expand') this.open();
                        else if (actionName === 'collapse') this.close();
                    }}
                >
                    {children}
                </TouchableOpacity>
            </Swipeable>
        );
    }
}
