import * as React from 'react';
import { Alert } from 'react-native';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import QRCodeScanner from './../components/QRCodeScanner';

import { localeString } from './../utils/LocaleUtils';

interface SparkQRProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'SparkQRScanner', { index: any }>;
}

export default class SparkQRScanner extends React.Component<SparkQRProps, {}> {
    handleSparkInvoiceScanned = (data: string) => {
        const { navigation, route } = this.props;

        const index = route.params?.index;

        const [url, accessKey] = data.split('?access-key=');

        if (url && accessKey) {
            navigation.navigate('WalletConfiguration', {
                node: { url, accessKey, implementation: 'spark' },
                enableTor: url && url.includes('.onion'),
                index
            });
        } else {
            Alert.alert(
                localeString('general.error'),
                localeString('views.SparkQRScanner.error'),
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );

            navigation.goBack();
        }
    };

    render() {
        const { navigation, route } = this.props;

        const index = route.params?.index;

        return (
            <QRCodeScanner
                text={localeString('views.SparkQRScanner.text')}
                handleQRScanned={this.handleSparkInvoiceScanned}
                goBack={() =>
                    navigation.navigate('WalletConfiguration', { index })
                }
                navigation={navigation}
            />
        );
    }
}
