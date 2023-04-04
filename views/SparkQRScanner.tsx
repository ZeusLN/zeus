import * as React from 'react';
import { Alert } from 'react-native';
import QRCodeScanner from './../components/QRCodeScanner';
import { localeString } from './../utils/LocaleUtils';
import { Implementation } from '../enums';

interface SparkQRProps {
    navigation: any;
}

export default class SparkQRScanner extends React.Component<SparkQRProps, {}> {
    handleSparkInvoiceScanned = (data: string) => {
        const { navigation } = this.props;

        const index = navigation.getParam('index', null);

        const [url, accessKey] = data.split('?access-key=');

        if (url && accessKey) {
            navigation.navigate('NodeConfiguration', {
                node: { url, accessKey, implementation: Implementation.spark },
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
        const { navigation } = this.props;

        const index = navigation.getParam('index', null);

        return (
            <QRCodeScanner
                text={localeString('views.SparkQRScanner.text')}
                handleQRScanned={this.handleSparkInvoiceScanned}
                goBack={() =>
                    navigation.navigate('NodeConfiguration', { index })
                }
                navigation={navigation}
            />
        );
    }
}
