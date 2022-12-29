import * as React from 'react';
import { Alert } from 'react-native';
import QRCodeScanner from './../components/QRCodeScanner';
import ConnectionFormatUtils from './../utils/ConnectionFormatUtils';
import { localeString } from './../utils/LocaleUtils';

interface CLightningRestQRScannerProps {
    navigation: any;
}

export default class CLightningRestQRScanner extends React.Component<
    CLightningRestQRScannerProps,
    {}
> {
    handleLNDConnectConfigInvoiceScanned = (data: string) => {
        const { navigation } = this.props;

        const index = navigation.getParam('index', null);

        const { host, port, macaroonHex, implementation, enableTor } =
            ConnectionFormatUtils.processCLightningRestConnectUrl(data);

        if (host && port && macaroonHex) {
            navigation.navigate('NodeConfiguration', {
                node: { host, port, macaroonHex, implementation, enableTor },
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
