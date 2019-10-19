import * as React from 'react';
import { Alert } from 'react-native';
import QRCodeScanner from './../components/QRCodeScanner';
import LndConnectUtils from './../utils/LndConnectUtils';

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

        const {
            host,
            port,
            macaroonHex
        } = LndConnectUtils.processLndConnectUrl(data);

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
