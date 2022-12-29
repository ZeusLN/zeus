import * as React from 'react';
import { Alert } from 'react-native';
import { inject, observer } from 'mobx-react';
import QRCodeScanner from './../components/QRCodeScanner';
import { localeString } from './../utils/LocaleUtils';

import SettingsStore from './../stores/SettingsStore';

interface BTCPayConfigQRProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class BTCPayConfigQRScanner extends React.Component<
    BTCPayConfigQRProps,
    {}
> {
    handleBTCPayConfigInvoiceScanned = (data: string) => {
        const { SettingsStore, navigation } = this.props;
        const { fetchBTCPayConfig } = SettingsStore;

        const index = navigation.getParam('index', null);

        fetchBTCPayConfig(data)
            .then((node: any) => {
                if (SettingsStore.btcPayError) {
                    Alert.alert(
                        localeString('general.error'),
                        SettingsStore.btcPayError,
                        [
                            {
                                text: localeString('general.ok'),
                                onPress: () => void 0
                            }
                        ],
                        { cancelable: false }
                    );
                }
                navigation.navigate('NodeConfiguration', {
                    node,
                    enableTor: node.host && node.host.includes('.onion'),
                    index
                });
            })
            .catch(() => {
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.BTCPayConfigQRScanner.error'),
                    [
                        {
                            text: localeString('general.ok'),
                            onPress: () => void 0
                        }
                    ],
                    { cancelable: false }
                );

                navigation.navigate('Settings');
            });
    };

    render() {
        const { navigation } = this.props;

        const index = navigation.getParam('index', null);

        return (
            <QRCodeScanner
                text={localeString('views.BTCPayConfigQRScanner.text')}
                handleQRScanned={this.handleBTCPayConfigInvoiceScanned}
                goBack={() =>
                    navigation.navigate('NodeConfiguration', { index })
                }
            />
        );
    }
}
