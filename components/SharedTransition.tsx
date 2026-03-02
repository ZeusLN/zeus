import * as React from 'react';
import {
    ImageSourcePropType,
    ImageStyle,
    TextStyle,
    ViewStyle
} from 'react-native';
import Animated, { FadeIn, SharedTransition } from 'react-native-reanimated';

export const sharedTransition = SharedTransition.duration(350).springify();

export const sharedTransitionEntering = FadeIn.delay(320).duration(100);

interface SharedBaseProps {
    /** Unique tag that pairs the source and destination elements. */
    tag: string;
    /**
     * Optional entering animation. Pass `sharedTransitionEntering` on
     * destination screens to fade content in after the transition lands.
     */
    entering?: any;
    /** Override the default shared transition style when needed. */
    transitionStyle?: any;
}

// ---------------------------------------------------------------------------
// SharedImage
// ---------------------------------------------------------------------------

interface SharedImageProps extends SharedBaseProps {
    source: ImageSourcePropType;
    style?: ImageStyle | ImageStyle[];
}

export const SharedImage: React.FC<SharedImageProps> = ({
    tag,
    source,
    style,
    entering,
    transitionStyle
}) => (
    <Animated.Image
        source={source}
        style={style}
        sharedTransitionTag={tag}
        sharedTransitionStyle={transitionStyle ?? sharedTransition}
        entering={entering}
    />
);

// ---------------------------------------------------------------------------
// SharedView
// ---------------------------------------------------------------------------

interface SharedViewProps extends SharedBaseProps {
    style?: ViewStyle | ViewStyle[];
    children?: React.ReactNode;
}

export const SharedView: React.FC<SharedViewProps> = ({
    tag,
    style,
    children,
    entering,
    transitionStyle
}) => (
    <Animated.View
        style={style}
        sharedTransitionTag={tag}
        sharedTransitionStyle={transitionStyle ?? sharedTransition}
        entering={entering}
        collapsable={false}
    >
        {children}
    </Animated.View>
);

// ---------------------------------------------------------------------------
// SharedText
// ---------------------------------------------------------------------------

interface SharedTextProps extends SharedBaseProps {
    style?: TextStyle | TextStyle[];
    children?: React.ReactNode;
}

export const SharedText: React.FC<SharedTextProps> = ({
    tag,
    style,
    children,
    entering,
    transitionStyle
}) => (
    <Animated.Text
        style={style}
        sharedTransitionTag={tag}
        sharedTransitionStyle={transitionStyle ?? sharedTransition}
        entering={entering}
    >
        {children}
    </Animated.Text>
);
