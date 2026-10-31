import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import LinearGradient from '../LinearGradient';
import LightningSvg from '../SVG/LightningSvg';
import OnChainSvg from '../SVG/OnChainSvg';

import { localeString } from '../../utils/LocaleUtils';

import CaretUp from '../../assets/images/SVG/Caret Up.svg';

import {
    PreviewTabBar,
    PreviewWalletHeader,
    SatAmount,
    ThemeColor
} from './parts';

// Mirrors views/Wallet/BalancePane.tsx and components/LayerBalances
export default function BalancePreview({
    theme,
    color
}: {
    theme: string;
    color: ThemeColor;
}) {
    // Same fallback chain as the Row in components/LayerBalances
    const rowColors = color('buttonGradient')
        ? color('buttonGradient')
        : color('buttonBackground')
        ? [color('buttonBackground'), color('buttonBackground')]
        : [color('secondary'), color('secondary')];
    const rowText = color('buttonText') || color('text');

    const rows = [
        {
            key: 'lightning',
            label: localeString('general.lightning'),
            sats: '845,210',
            icon: <LightningSvg theme={theme} />
        },
        {
            key: 'onchain',
            label: localeString('general.onchain'),
            sats: '404,790',
            icon: <OnChainSvg theme={theme} />
        }
    ];

    return (
        <View style={styles.container}>
            <PreviewWalletHeader color={color} />
            <View style={styles.total}>
                <SatAmount
                    sats="1,250,000"
                    color={color('text')}
                    unitColor={color('secondaryText')}
                    fontSize={40}
                />
            </View>
            {rows.map((row) => (
                <LinearGradient
                    key={row.key}
                    colors={rowColors}
                    style={styles.row}
                >
                    <View style={styles.rowLeft}>
                        {row.icon}
                        <Text style={[styles.rowLabel, { color: rowText }]}>
                            {row.label}
                        </Text>
                    </View>
                    <SatAmount
                        sats={row.sats}
                        color={color('buttonText')}
                        unitColor={color('buttonText')}
                    />
                </LinearGradient>
            ))}
            <View style={styles.activity}>
                <CaretUp fill={color('text')} />
                <Text style={[styles.activityText, { color: color('text') }]}>
                    {localeString('general.activity')}
                </Text>
            </View>
            <PreviewTabBar color={color} active="balance" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    total: {
        alignItems: 'center',
        marginTop: 50,
        marginBottom: 60
    },
    row: {
        height: 80,
        marginHorizontal: 15,
        marginBottom: 20,
        borderRadius: 50,
        paddingLeft: 6,
        paddingRight: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    rowLabel: {
        marginLeft: 5,
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Medium'
    },
    activity: {
        position: 'absolute',
        bottom: 75,
        left: 0,
        right: 0,
        alignItems: 'center'
    },
    activityText: {
        marginTop: 7,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
