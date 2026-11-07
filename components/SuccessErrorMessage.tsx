import React, { useContext, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Keyboard,
    LayoutAnimation,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Icon } from '@rneui/themed';
import { NavigationContext } from '@react-navigation/native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

import {
    ANIMATION_DURATION,
    hideErrorBanner,
    showErrorBanner
} from './ErrorBanner';

import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

// Content scrolled under the header reports an on-screen position
const HEADER_HEIGHT = 56;

// How often a mounted error checks whether scrolling has moved it on or off
// screen. React Native has no way to observe this without the screen's
// ScrollView taking part.
const POSITION_CHECK_INTERVAL = 100;
// The gap between these keeps a message resting at the edge of the screen from
// flickering between the inline card and the banner.
const SHOW_BANNER_BELOW = 0.5;
const HIDE_BANNER_ABOVE = 0.9;

let nextBannerId = 0;

const getVisibleFraction = (y: number, height: number) => {
    const top = (initialWindowMetrics?.insets.top ?? 0) + HEADER_HEIGHT;
    const bottom = Keyboard.isVisible()
        ? Keyboard.metrics()?.screenY ?? Dimensions.get('window').height
        : Dimensions.get('window').height;
    const visible = Math.min(y + height, bottom) - Math.max(y, top);
    return height > 0 ? Math.max(visible, 0) / height : 0;
};

interface MessageProps {
    message?: string;
    fontSize?: number;
    link?: string;
    mainStyle?: any;
    dismissable?: boolean;
    onPress?: () => void;
}

interface VariantProps extends MessageProps {
    icon: string;
    colors: { accent: string; background: string };
    // repeat the message in a floating banner when it appears off-screen
    showBanner?: boolean;
}

const Message = ({
    message,
    fontSize,
    link,
    dismissable,
    onPress,
    icon,
    colors,
    showBanner
}: VariantProps) => {
    // keyed by message so that dismissing one error can't hide the next one
    const [dismissedMessage, setDismissedMessage] = useState<string>();
    const isDismissed = !!message && dismissedMessage === message;
    const [isInBanner, setIsInBanner] = useState(false);

    const navigation = useContext(NavigationContext);
    const containerRef = useRef<View>(null);
    const inlineOpacity = useRef(new Animated.Value(1)).current;
    // for a dismissable message, onPress is how its screen clears the error
    const onDismissRef = useRef<(() => void) | undefined>(undefined);
    onDismissRef.current = dismissable ? onPress : undefined;
    const bannerId = useRef(++nextBannerId).current;

    useEffect(() => {
        if (!showBanner || !message || isDismissed) return;

        let cancelled = false;
        let inBanner = false;
        let hidingFromScroll = false;

        const hideFromScroll = () => {
            hidingFromScroll = true;
            hideErrorBanner(bannerId);
            hidingFromScroll = false;
        };

        const interval = setInterval(() => {
            if (navigation && !navigation.isFocused()) return;
            containerRef.current?.measureInWindow?.((_x, y, width, height) => {
                if (cancelled || (!width && !height)) return;
                const visibleFraction = getVisibleFraction(y, height);
                if (!inBanner && visibleFraction <= SHOW_BANNER_BELOW) {
                    inBanner = true;
                    setIsInBanner(true);
                    showErrorBanner(bannerId, message, (closedByUser) => {
                        inBanner = false;
                        setIsInBanner(false);
                        // closed or timed out: scrolling won't bring it back
                        if (!hidingFromScroll) clearInterval(interval);
                        if (closedByUser) {
                            LayoutAnimation.easeInEaseOut();
                            setDismissedMessage(message);
                            onDismissRef.current?.();
                        }
                    });
                } else if (inBanner && visibleFraction >= HIDE_BANNER_ABOVE) {
                    hideFromScroll();
                }
            });
        }, POSITION_CHECK_INTERVAL);

        // a banner never outlives its screen
        const unsubscribeBlur = navigation?.addListener('blur', hideFromScroll);

        return () => {
            cancelled = true;
            clearInterval(interval);
            unsubscribeBlur?.();
            hideFromScroll();
        };
    }, [bannerId, isDismissed, message, navigation, showBanner]);

    useEffect(() => {
        Animated.timing(inlineOpacity, {
            toValue: isInBanner ? 0 : 1,
            duration: ANIMATION_DURATION,
            useNativeDriver: true
        }).start();
    }, [inlineOpacity, isInBanner]);

    if (isDismissed) return <></>;

    const handlePress = onPress
        ? onPress
        : dismissable
        ? () => setDismissedMessage(message)
        : link
        ? () => UrlUtils.goToUrl(link)
        : undefined;

    const content = (
        <>
            <Icon
                name={icon}
                size={20}
                color={colors.accent}
                containerStyle={styles.icon}
            />
            <Text
                style={[
                    styles.text,
                    { color: themeColor('text'), fontSize: fontSize || 16 }
                ]}
            >
                {message}
            </Text>
            {(!!link || (dismissable && !onPress)) && (
                <Icon
                    name={link && !dismissable ? 'chevron-right' : 'close'}
                    size={18}
                    color={themeColor('secondaryText')}
                    containerStyle={styles.action}
                />
            )}
        </>
    );

    const cardStyle = [
        styles.card,
        { backgroundColor: colors.background, borderColor: colors.background }
    ];

    // The banner takes over from the inline message while it's up. The inline
    // message keeps its space so that the content below it doesn't jump, and
    // comes back with the error still readable when the banner goes away.
    return (
        <Animated.View
            ref={containerRef}
            collapsable={false}
            accessibilityElementsHidden={isInBanner}
            importantForAccessibility={
                isInBanner ? 'no-hide-descendants' : 'auto'
            }
            style={[styles.container, { opacity: inlineOpacity }]}
        >
            {handlePress ? (
                <TouchableOpacity
                    style={cardStyle}
                    disabled={isInBanner}
                    onPress={handlePress}
                >
                    {content}
                </TouchableOpacity>
            ) : (
                <View style={cardStyle}>{content}</View>
            )}
        </Animated.View>
    );
};

const SUCCESS_COLORS = {
    accent: '#41CF3E',
    background: 'rgba(65, 207, 62, 0.14)'
};
const WARNING_COLORS = {
    accent: '#E5B800',
    background: 'rgba(255, 214, 10, 0.14)'
};
const ERROR_COLORS = {
    accent: '#E14C4C',
    background: 'rgba(225, 76, 76, 0.14)'
};

const SuccessMessage = (props: MessageProps) => (
    <Message {...props} icon="check-circle-outline" colors={SUCCESS_COLORS} />
);

const WarningMessage = (props: MessageProps) => (
    <Message {...props} icon="warning-amber" colors={WARNING_COLORS} />
);

const ErrorMessage = (props: MessageProps) => (
    <Message {...props} icon="error-outline" colors={ERROR_COLORS} showBanner />
);

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginVertical: 10,
        paddingHorizontal: 8
    },
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: 12,
        borderWidth: 1,
        padding: 12
    },
    icon: {
        marginRight: 10
    },
    text: {
        flex: 1,
        fontFamily: 'PPNeueMontreal-Book',
        lineHeight: 20
    },
    action: {
        marginLeft: 10
    }
});

export { SuccessMessage, WarningMessage, ErrorMessage };
