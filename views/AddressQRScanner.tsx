/** @format */

import * as React from 'react';
import { Alert } from 'react-native';
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
export default class AddressQRScanner extends React.Component<
    AddressQRProps,
    {}
> {
    constructor(props: any) {
        super(props);

        this.state = {
            useInternalScanner: false
        };
    }

    handleAddressInvoiceScanned = (data: string) => {
        const { NodeInfoStore, navigation } = this.props;
        const { testnet } = NodeInfoStore;

        const { value, amount } = AddressUtils.processSendAddress(data);

        if (AddressUtils.isValidBitcoinAddress(value, testnet)) {
            navigation.navigate('Send', {
                destination: value,
                amount,
                transactionType: 'On-chain'
            });
        } else if (AddressUtils.isValidLightningPaymentRequest(value)) {
            navigation.navigate('Send', {
                destination: value,
                transactionType: 'Lightning'
            });
        } else {
            Alert.alert(
                'Error',
                'Scanned QR code was not a valid Bitcoin address or Lightning Invoice',
                [{ text: 'OK', onPress: () => void 0 }],
                { cancelable: false }
            );

            navigation.navigate('Send');
        }
    };

    render() {
        const { navigation } = this.props;

        return (
            <QRCodeScanner
                title="Address/Payment Request QR Scanner"
                text="Scan a valid Bitcoin address or Lightning payment request"
                handleQRScanned={this.handleAddressInvoiceScanned}
                goBack={() => navigation.navigate('Send')}
            />
        );
    }
}
