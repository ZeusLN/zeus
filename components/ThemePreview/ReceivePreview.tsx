import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@rneui/themed';
import QRCode from 'react-native-qrcode-svg';

import { localeString } from '../../utils/LocaleUtils';

import ArrowLeft from '../../assets/images/SVG/Arrow_left.svg';

import { BASE_WIDTH } from './constants';
import { SatAmount, ThemeColor } from './parts';

const defaultLogo = require('../../assets/images/icon_black.png');
const defaultLogoWhite = require('../../assets/images/icon_white.png');

// Example invoice from the BOLT 11 spec; it only feeds the QR pattern
const INVOICE =
    'lightning:LNBC2500U1PVJLUEZSP5ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYG3ZYGSPP5QQQSYQCYQ5RQWZQFQQQSYQCYQ5RQWZQFQQQSYQCYQ5RQWZQFQYPQDQ5XYSXXATSYP3K7ENXV4JSXQZPU9QRSGQUK0RL77NJ30YXDY8J9VDX85FKPMDLA2087NE0XH8NHEDH8W27KYKE0LP53UT353S06FV3QFEGEXT0EH0YMJPF39TUVEN09SAM30G4VGPFNA3RH';

const QR_SIZE = BASE_WIDTH * 0.75;

// Mirrors views/Receive.tsx and components/CollapsedQR.tsx
export default function ReceivePreview({ color }: { color: ThemeColor }) {
    const panelBackground = color('buttonBackground') || color('secondary');

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <ArrowLeft fill={color('text')} width="30" height="30" />
                <Text style={[styles.title, { color: color('text') }]}>
                    {localeString('views.Receive.title')}
                </Text>
                <View style={styles.headerSpacer} />
            </View>
            <View
                style={[styles.qr, { backgroundColor: color('qr') || 'white' }]}
            >
                <QRCode
                    value={INVOICE}
                    size={QR_SIZE}
                    logo={
                        color('invertQrIcons') ? defaultLogoWhite : defaultLogo
                    }
                    color={color('qr') || 'black'}
                    backgroundColor={color('qrBackground') || 'white'}
                    logoBackgroundColor={color('qrLogoBackground') || 'white'}
                    logoMargin={10}
                    quietZone={BASE_WIDTH / 40}
                />
            </View>
            <View style={[styles.panel, { backgroundColor: panelBackground }]}>
                <SatAmount
                    sats="250,000"
                    color={color('buttonText')}
                    unitColor={color('buttonText')}
                    fontSize={40}
                />
            </View>
            <Text
                style={[styles.invoice, { color: color('secondaryText') }]}
                numberOfLines={3}
            >
                {INVOICE}
            </Text>
            <View style={styles.actions}>
                <Icon
                    name="content-copy"
                    size={25}
                    color={color('secondaryText')}
                />
                <Icon name="share" size={25} color={color('secondaryText')} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 60
    },
    title: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    headerSpacer: {
        width: 30
    },
    qr: {
        alignSelf: 'center',
        marginTop: 10
    },
    panel: {
        alignSelf: 'center',
        alignItems: 'center',
        width: QR_SIZE,
        padding: 15,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12
    },
    invoice: {
        marginTop: 20,
        marginHorizontal: 40,
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 60,
        marginTop: 25
    }
});
