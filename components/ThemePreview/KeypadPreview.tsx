import * as React from 'react';
import { DimensionValue, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@rneui/themed';

import { localeString } from '../../utils/LocaleUtils';

import DeleteKey from '../../assets/images/SVG/DeleteKey.svg';

import {
    PreviewTabBar,
    PreviewWalletHeader,
    SatAmount,
    ThemeColor
} from './parts';

const KEYS = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'delete']
];

// Mirrors views/Wallet/KeypadPane.tsx and components/PinPad.tsx
export default function KeypadPreview({ color }: { color: ThemeColor }) {
    // Quaternary Button colors from components/Button.tsx
    const buttonBackground = color('buttonBackground') || color('secondary');
    const buttonText = color('buttonText') || color('text');

    const button = (width: DimensionValue, content: React.ReactNode) => (
        <View style={[styles.buttonCell, { width }]}>
            <View
                style={[styles.button, { backgroundColor: buttonBackground }]}
            >
                {content}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <PreviewWalletHeader color={color} />
            <View style={styles.amount}>
                <SatAmount
                    sats="21,000"
                    color={color('text')}
                    unitColor={color('secondaryText')}
                    fontSize={80}
                />
            </View>
            <View style={styles.unitRow}>
                <View
                    style={[
                        styles.unitToggle,
                        { backgroundColor: buttonBackground }
                    ]}
                >
                    <Icon name="import-export" size={20} color={buttonText} />
                    <Text style={[styles.buttonText, { color: buttonText }]}>
                        {localeString('general.sats')}
                    </Text>
                </View>
            </View>
            <View style={styles.pad}>
                {KEYS.map((row, index) => (
                    <View key={index} style={styles.padRow}>
                        {row.map((key) => (
                            <View key={key} style={styles.key}>
                                {key === 'delete' ? (
                                    <DeleteKey
                                        fill={color('text')}
                                        width="30"
                                        height="30"
                                    />
                                ) : (
                                    <Text
                                        style={[
                                            styles.keyText,
                                            { color: color('text') }
                                        ]}
                                    >
                                        {key}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                ))}
            </View>
            <View style={styles.buttons}>
                {button(
                    '40%',
                    <Text style={[styles.buttonText, { color: buttonText }]}>
                        {localeString('general.request')}
                    </Text>
                )}
                {button(
                    '20%',
                    <Icon
                        name="pencil"
                        type="font-awesome"
                        size={20}
                        color={buttonText}
                    />
                )}
                {button(
                    '40%',
                    <Text style={[styles.buttonText, { color: buttonText }]}>
                        {localeString('general.send')}
                    </Text>
                )}
            </View>
            <PreviewTabBar color={color} active="keypad" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    amount: {
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 30
    },
    unitRow: {
        alignItems: 'center',
        marginBottom: 20
    },
    unitToggle: {
        height: 40,
        borderRadius: 5,
        paddingHorizontal: 15,
        flexDirection: 'row',
        alignItems: 'center'
    },
    pad: {
        paddingHorizontal: 15
    },
    padRow: {
        flexDirection: 'row',
        marginVertical: 10
    },
    key: {
        flex: 1,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center'
    },
    keyText: {
        fontSize: 24,
        fontFamily: 'PPNeueMontreal-Medium'
    },
    buttons: {
        position: 'absolute',
        bottom: 65,
        left: 0,
        right: 0,
        flexDirection: 'row'
    },
    buttonCell: {
        alignItems: 'center'
    },
    button: {
        width: '90%',
        height: 40,
        borderRadius: 5,
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonText: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
