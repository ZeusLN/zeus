import * as React from 'react';
import { Alert } from 'react-native';
import { Icon } from 'react-native-elements';
import QRCodeScanner from './../components/QRCodeScanner';
import { inject, observer } from 'mobx-react';

import SettingsStore from './../stores/SettingsStore';

interface BTCPayConfigQRProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class BTCPayConfigQRScanner extends React.Component<BTCPayConfigQRProps, {}> {
    handleBTCPayConfigInvoiceScanned = ({ data }: any) => {
        const { SettingsStore, navigation } = this.props;
        const { fetchBTCPayConfig } = SettingsStore;

        fetchBTCPayConfig(data).then((config: any) => {
            navigation.navigate('Settings', { ...config });
        }).catch(() => {
            Alert.alert(
                'Error',
                'Error fetching BTCPay config',
                [
                    {text: 'OK', onPress: () => void(0)}
                ],
                {cancelable: false}
            );

            navigation.navigate('Settings');
        });
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
                title="BTCPay Config QR Scanner"
                text="Scan a BTCPay Config under Settings > Services > LND Rest"
                handleQRScanned={this.handleBTCPayConfigInvoiceScanned}
                BackButton={BackButton}
            />
        );
    }
}