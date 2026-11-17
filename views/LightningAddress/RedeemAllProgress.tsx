import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import Amount from '../../components/Amount';
import Text from '../../components/Text';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

export const COUNT_UP_DURATION_MS = 500;

interface RedeemAllProgressProps {
    redeemed: number;
    total: number;
    amountMsat: number;
}

// Animates from the currently displayed amount to `targetMsat` each time it
// changes, so a new payment counts up from the previous total
const useCountUp = (targetMsat: number) => {
    const [displayedMsat, setDisplayedMsat] = React.useState(targetMsat);
    const displayedRef = React.useRef(targetMsat);

    React.useEffect(() => {
        const from = displayedRef.current;
        if (from === targetMsat) return;

        let frame: number;
        let start: number | undefined;
        const step = (now: number) => {
            if (start === undefined) start = now;
            const progress = Math.min((now - start) / COUNT_UP_DURATION_MS, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            // whole sats while counting, the exact amount at the end
            const value =
                progress < 1
                    ? Math.round((from + (targetMsat - from) * eased) / 1000) *
                      1000
                    : targetMsat;
            displayedRef.current = value;
            setDisplayedMsat(value);
            if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);

        return () => cancelAnimationFrame(frame);
    }, [targetMsat]);

    return displayedMsat;
};

export default function RedeemAllProgress({
    redeemed,
    total,
    amountMsat
}: RedeemAllProgressProps) {
    const displayedMsat = useCountUp(amountMsat);

    return (
        <View style={[styles.wrapper, { pointerEvents: 'none' }]}>
            <View style={styles.card}>
                {/* Frosted glass without a blur library: a translucent tint
                    lets the pattern show through dimmed, with a highlight
                    across the top edge */}
                <View
                    style={[
                        styles.layer,
                        styles.tint,
                        { backgroundColor: themeColor('background') }
                    ]}
                />
                <View style={[styles.layer, styles.highlight]} />
                <Amount sats={displayedMsat / 1000} jumboText />
                <Text
                    style={{
                        ...styles.count,
                        color: themeColor('secondaryText')
                    }}
                >
                    {localeString(
                        'views.Settings.LightningAddress.redeemAllProgress',
                        { redeemed, total }
                    )}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center'
    },
    card: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 30
    },
    layer: {
        ...StyleSheet.absoluteFill
    },
    tint: {
        opacity: 0.6
    },
    highlight: {
        experimental_backgroundImage:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0) 60%)'
    },
    count: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 18,
        marginTop: 10
    }
});
