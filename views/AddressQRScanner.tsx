import * as React from 'react';
import { Alert } from 'react-native';
import { Icon } from 'react-native-elements';
import AddressUtils from './../utils/AddressUtils';
import QRCodeScanner from './../components/QRCodeScanner';
import { inject, observer } from 'mobx-react';

import NodeInfoStore from './../stores/NodeInfoStore';

interface AddressQRProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
}

@inject('NodeInfoStore')
@observer
export default class AddressQRScanner extends React.Component<AddressQRProps, {}> {
    handleAddressInvoiceScanned = (data: string) => {
        const { NodeInfoStore, navigation } = this.props;
        const { testnet } = NodeInfoStore;
        let processedValue;

        data = data.toLowerCase();

        // handle addresses prefixed with 'bitcoin:',
        // payment requests prefixed with 'lightning:', and
        // lnurls either prefixed with 'lightning:' or sent as a querystring fallback at '?lightning='
        if (data.includes('bitcoin:')) {
            processedValue = data.split('bitcoin:')[1];
        } else if (data.includes('lightning:')) {
            processedValue = data.split('lightning:')[1];
        } else if (data.includes('lightning=')) {
            processedValue = data.split('lightning=')[1].split('&')[0];
        } else {
            processedValue = data;
        }

        if (AddressUtils.isValidBitcoinAddress(processedValue, testnet)) {
            navigation.navigate('Send', { destination: processedValue, transactionType: 'On-chain' });
        } else if (AddressUtils.isValidLightningPaymentRequest(processedValue)) {
            navigation.navigate('Send', { destination: processedValue, transactionType: 'Lightning' });
        } else if (AddressUtils.isValidLNURL(processedValue)) {
            navigation.navigate('Receive', { lnurl: processedValue });
        } else {
            Alert.alert(
                'Error',
                'Scanned QR code was not a valid Bitcoin address or Lightning Invoice',
                [
                    {text: 'OK', onPress: () => void(0)}
                ],
                {cancelable: false}
            );

            navigation.navigate('Send');
        }
    }
    render() {
        const { navigation } = this.props;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Send')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <QRCodeScanner
                title="Address/Payment Request QR Scanner"
                text="Scan a valid Bitcoin address or Lightning payment request"
                handleQRScanned={this.handleAddressInvoiceScanned}
                BackButton={BackButton}
            />
        );
    }
}
