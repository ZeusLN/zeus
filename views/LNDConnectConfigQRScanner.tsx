import * as React from 'react';
import { Alert } from 'react-native';
import { Icon } from 'react-native-elements';
import QRCodeScanner from './../components/QRCodeScanner';
import MacaroonUtils from './../utils/MacaroonUtils';

interface LNDConnectConfigQRProps {
    navigation: any;
}

export default class LNDConnectConfigQRScanner extends React.Component<LNDConnectConfigQRProps, {}> {
    handleLNDConnectConfigInvoiceScanned = ({ data }: any) => {
        const { navigation } = this.props;

        const host = data.split('lndconnect://')[1].split(':')[0];
        const port = data.split('lndconnect://')[1].split(':')[1].split('?')[0];
        const macaroonHex = data.split('&macaroon=')[1] && MacaroonUtils.base64UrlToHex(data.split('&macaroon=')[1]);


        if (host && port && macaroonHex) {
            navigation.navigate('Settings', { host, port, macaroonHex });
        } else {
            Alert.alert(
                'Error',
                'Error fetching lndconnect config',
                [
                    {text: 'OK', onPress: () => void(0)}
                ],
                {cancelable: false}
            );

            navigation.navigate('Settings');
        }
    }

    render() {
        const { navigation } = this.props;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Settings')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <QRCodeScanner
                title="lndconnect Config QR Scanner"
                text="Scan a lndconnect Config. Make sure you've told lndconnect to use your REST port."
                handleQRScanned={this.handleLNDConnectConfigInvoiceScanned}
                BackButton={BackButton}
            />
        );
    }
}