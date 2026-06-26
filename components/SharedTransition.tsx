import * as React from 'react';
import {
    ImageSourcePropType,
    ImageStyle,
    TextStyle,
    ViewStyle
} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    SharedTransition,
    SharedTransitionBoundary
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';

export const sharedTransition = SharedTransition.springify(400).dampingRatio(1);
export const sharedTransitionEntering = FadeIn.delay(350)
    .duration(220)
    .easing(Easing.out(Easing.cubic));

// ---------------------------------------------------------------------------
// SharedScreen
//
// Reanimated 4.4+ requires a `SharedTransitionBoundary` to mark the source and
// destination subtrees for shared element transitions; without it the
// experimental layout proxy never collects `sharedTransitionTag`s and the
// animation silently no-ops. Wrap the content of any screen that participates
// in a shared transition with this component.
// ---------------------------------------------------------------------------

interface SharedScreenProps {
    children?: React.ReactNode;
}

export const SharedScreen: React.FC<SharedScreenProps> = ({ children }) => {
    const isFocused = useIsFocused();
    return (
        <SharedTransitionBoundary isActive={isFocused}>
            {children}
        </SharedTransitionBoundary>
    );
};

interface SharedBaseProps {
    /** Unique tag that pairs the source and destination elements. */
    tag: string;
    /**
     * Optional entering animation. Pass `sharedTransitionEntering` on
     * destination screens to fade content in after the transition lands.
     */
    entering?: FadeIn;
    /** Override the default shared transition style when needed. */
    transitionStyle?: SharedTransition;
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
