import * as React from 'react';
import {
    AccessibilityInfo,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Icon } from '@rneui/themed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

const DURATION = 8000;
// about how long it takes to read a message too long for the minimum above
const DURATION_PER_CHARACTER = 60;
export const ANIMATION_DURATION = 200;
const ERROR_COLOR = '#E14C4C';
const ERROR_TINT = 'rgba(225, 76, 76, 0.2)';

interface BannerEntry {
    id: number;
    message: string;
    onHide: (closedByUser: boolean) => void;
}

let entries: BannerEntry[] = [];
let listeners: Array<(entry: BannerEntry | null) => void> = [];

const getCurrentEntry = () =>
    entries.length ? entries[entries.length - 1] : null;

const notify = () => {
    const current = getCurrentEntry();
    listeners.forEach((l) => l(current));
};

// The most recently shown error wins. An id can only appear once, so an error
// whose text changes replaces its previous banner.
export function showErrorBanner(
    id: number,
    message: string,
    onHide: (closedByUser: boolean) => void
) {
    entries = [...entries.filter((e) => e.id !== id), { id, message, onHide }];
    notify();
}

export function hideErrorBanner(id: number, closedByUser = false) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    entries = entries.filter((e) => e.id !== id);
    notify();
    entry.onHide(closedByUser);
}

export default function ErrorBannerHost() {
    const insets = useSafeAreaInsets();
    const [current, setCurrent] = React.useState<BannerEntry | null>(null);
    // stays set through the exit animation, after current has cleared
    const [displayed, setDisplayed] = React.useState<BannerEntry | null>(null);
    const progress = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        listeners.push(setCurrent);
        // an error can be raised before this host has subscribed
        setCurrent(getCurrentEntry());
        return () => {
            listeners = listeners.filter((l) => l !== setCurrent);
        };
    }, []);

    React.useEffect(() => {
        if (!current) {
            const exit = Animated.timing(progress, {
                toValue: 0,
                duration: ANIMATION_DURATION,
                useNativeDriver: true
            });
            exit.start(({ finished }) => {
                if (finished) setDisplayed(null);
            });
            return () => exit.stop();
        }

        setDisplayed(current);
        AccessibilityInfo.announceForAccessibility(current.message);
        Animated.timing(progress, {
            toValue: 1,
            duration: ANIMATION_DURATION,
            useNativeDriver: true
        }).start();
        const timeout = setTimeout(
            () => hideErrorBanner(current.id),
            Math.max(DURATION, current.message.length * DURATION_PER_CHARACTER)
        );
        return () => clearTimeout(timeout);
    }, [current, progress]);

    if (!displayed) return null;
    return (
        <Animated.View
            style={[
                styles.container,
                {
                    top: insets.top + 8,
                    opacity: progress,
                    transform: [
                        {
                            translateY: progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-16, 0]
                            })
                        }
                    ]
                }
            ]}
        >
            <View
                testID="error-banner"
                style={[
                    styles.banner,
                    { backgroundColor: themeColor('background') }
                ]}
            >
                <View style={styles.tint} />
                <Icon
                    name="error-outline"
                    size={20}
                    color={ERROR_COLOR}
                    containerStyle={styles.icon}
                />
                <ScrollView style={styles.scroll}>
                    <Text style={[styles.text, { color: themeColor('text') }]}>
                        {displayed.message}
                    </Text>
                </ScrollView>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={localeString('general.close')}
                    hitSlop={12}
                    onPress={() => hideErrorBanner(displayed.id, true)}
                    style={styles.close}
                >
                    <Icon
                        name="close"
                        size={18}
                        color={themeColor('secondaryText')}
                    />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        pointerEvents: 'box-none',
        position: 'absolute',
        left: 16,
        right: 16
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: 12,
        padding: 12,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8
    },
    // over an opaque background, so that content can't show through the banner
    tint: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        pointerEvents: 'none',
        backgroundColor: ERROR_TINT,
        borderRadius: 12
    },
    icon: {
        marginRight: 10
    },
    // the message scrolls past this height, which keeps the close button in reach
    scroll: {
        flex: 1,
        maxHeight: 200
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 15,
        lineHeight: 20
    },
    close: {
        marginLeft: 10
    }
});
