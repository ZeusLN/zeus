import * as React from 'react';
import { Alert } from 'react-native';
import QRCodeScanner from './../components/QRCodeScanner';
import ConnectionFormatUtils from './../utils/ConnectionFormatUtils';
import { localeString } from './../utils/LocaleUtils';

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

        const { host, port, macaroonHex } =
            ConnectionFormatUtils.processLndConnectUrl(data);

        if (host && port && macaroonHex) {
            navigation.navigate('NodeConfiguration', {
                node: { host, port, macaroonHex, implementation: 'lnd' },
                enableTor: host && host.includes('.onion'),
                index
            });
        } else {
            Alert.alert(
                localeString('general.error'),
                localeString('views.LNDConnectConfigQRScanner.error'),
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
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
                handleQRScanned={this.handleLNDConnectConfigInvoiceScanned}
                goBack={() =>
                    navigation.navigate('NodeConfiguration', { index })
                }
            />
        );
    }
}
