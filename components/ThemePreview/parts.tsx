import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { localeString } from '../../utils/LocaleUtils';
import { themeColorFor } from '../../utils/ThemeUtils';

import BitcoinIcon from '../../assets/images/SVG/Bitcoin.svg';
import ChannelsIcon from '../../assets/images/SVG/Channels.svg';
import MenuIcon from '../../assets/images/SVG/Menu.svg';
import ScanIcon from '../../assets/images/SVG/Scan.svg';
import TempleIcon from '../../assets/images/SVG/Temple.svg';

// The previews mirror the real screens, so every color comes from the
// previewed theme through themeColorFor rather than from themeColor.
export type ThemeColor = (key: string) => any;

export const colorsFor =
    (theme: string): ThemeColor =>
    (key: string) =>
        themeColorFor(theme, key);

export function SatAmount({
    sats,
    color,
    unitColor,
    fontSize = 16
}: {
    sats: string;
    color: string;
    unitColor: string;
    fontSize?: number;
}) {
    return (
        <View style={styles.amountRow}>
            <Text style={[styles.amount, { color, fontSize }]}>{sats}</Text>
            <Text
                style={[
                    styles.unit,
                    {
                        color: unitColor,
                        fontSize: Math.max(12, Math.round(fontSize * 0.5))
                    }
                ]}
            >
                {` ${localeString('general.sats')}`}
            </Text>
        </View>
    );
}

// Menu button and node avatar, as drawn by WalletHeader
export function PreviewWalletHeader({
    color,
    right
}: {
    color: ThemeColor;
    right?: React.ReactNode;
}) {
    return (
        <View style={styles.header}>
            <MenuIcon fill={color('text')} width={38} height={38} />
            {right || (
                <View
                    style={[
                        styles.avatar,
                        { backgroundColor: color('secondary') }
                    ]}
                />
            )}
        </View>
    );
}

export type PreviewTab = 'balance' | 'keypad' | 'channels';

// Bottom tab bar from views/Wallet/Wallet.tsx
export function PreviewTabBar({
    color,
    active
}: {
    color: ThemeColor;
    active: PreviewTab;
}) {
    const tint = (tab: PreviewTab) => (tab === active ? color('text') : 'gray');
    return (
        <View style={[styles.tabBar, { backgroundColor: color('background') }]}>
            <TempleIcon fill={tint('balance')} />
            <BitcoinIcon fill={tint('keypad')} />
            <ChannelsIcon height={26} width={26} fill={tint('channels')} />
            <ScanIcon fill="gray" width={20} />
        </View>
    );
}

const styles = StyleSheet.create({
    amountRow: {
        flexDirection: 'row',
        alignItems: 'baseline'
    },
    amount: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    unit: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 60
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19
    },
    tabBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 55,
        paddingBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center'
    }
});
