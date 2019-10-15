/** @format */

import * as React from 'react';
import { Alert } from 'react-native';
import QRCodeScanner from './../components/QRCodeScanner';
import MacaroonUtils from './../utils/MacaroonUtils';

interface LNDConnectConfigQRProps {
    navigation: any;
}

export default class LNDConnectConfigQRScanner extends React.Component<
    LNDConnectConfigQRProps,
    {}
> {
    handleLNDConnectConfigInvoiceScanned = (data: string) => {
        const { navigation } = this.props;

        const index = navigation.getParam('index', null);

        const host =
            data.split('lndconnect://')[1] &&
            data.split('lndconnect://')[1].split(':')[0];
        const port =
            data.split('lndconnect://')[1] &&
            data.split('lndconnect://')[1].split(':')[1] &&
            data
                .split('lndconnect://')[1]
                .split(':')[1]
                .split('?')[0];
        const macaroonHex =
            data.split('&macaroon=')[1] &&
            MacaroonUtils.base64UrlToHex(data.split('&macaroon=')[1]);

        if (host && port && macaroonHex) {
            navigation.navigate('AddEditNode', {
                node: { host, port, macaroonHex },
                index
            });
        } else {
            Alert.alert(
                'Error',
                'Error fetching lndconnect config',
                [{ text: 'OK', onPress: () => void 0 }],
                { cancelable: false }
            );

            navigation.navigate('Settings');
        }
    };

    render() {
        const { navigation } = this.props;

        const index = navigation.getParam('index', null);

        return (
            <QRCodeScanner
                title="lndconnect Config QR Scanner"
                text="Scan a lndconnect Config. Make sure you've told lndconnect to use your REST port."
                handleQRScanned={this.handleLNDConnectConfigInvoiceScanned}
                goBack={() => navigation.navigate('AddEditNode', { index })}
            />
        );
    }
}
