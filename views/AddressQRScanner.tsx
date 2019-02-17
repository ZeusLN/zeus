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
    handleAddressInvoiceScanned = ({ data }: any) => {
        const { NodeInfoStore, navigation } = this.props;
        const { testnet } = NodeInfoStore;
        let processedValue;

        // handle addresses prefixed with 'bitcoin:'
        if (data.includes('bitcoin:')) {
            processedValue = data.split('bitcoin:')[1];
        } else {
            processedValue = data;
        }

        if (AddressUtils.isValidBitcoinAddress(processedValue, testnet)) {
            navigation.navigate('Send', { destination: processedValue, transactionType: 'On-chain Transaction' });
        } else if (AddressUtils.isValidLightningInvoice(processedValue)) {
            navigation.navigate('Send', { destination: processedValue, transactionType: 'Lightning Transaction' });
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
                title="Address/Invoice QR Scanner"
                text="Scan a valid Bitcoin address or Lightning invoice"
                handleQRScanned={this.handleAddressInvoiceScanned}
                BackButton={BackButton}
            />
        );
    }
}