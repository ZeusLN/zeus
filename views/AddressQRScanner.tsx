import * as React from 'react';
import { Alert } from 'react-native';
import AddressUtils from './../utils/AddressUtils';
import QRCodeScanner from './../components/QRCodeScanner';
import { inject, observer } from 'mobx-react';
import { getParams as getlnurlParams, findlnurl } from 'js-lnurl';

import NodeInfoStore from './../stores/NodeInfoStore';
import InvoicesStore from './../stores/InvoicesStore';

interface AddressQRProps {
    navigation: any;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
}

@inject('InvoicesStore', 'NodeInfoStore')
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
        const { InvoicesStore, NodeInfoStore, navigation } = this.props;
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

            InvoicesStore.getPayReq(value);
            navigation.navigate('PaymentRequest');
        } else if (findlnurl(value.toLowerCase()) !== null) {
            getlnurlParams(findlnurl(value.toLowerCase()))
                .then(params => {
                    switch (params.tag) {
                        case 'withdrawRequest':
                            navigation.navigate('Receive', {
                                lnurlParams: params
                            });
                            break;
                        default:
                            throw new Error(
                                params.reason ||
                                    `Unsupported lnurl type: ${params.tag}`
                            );
                    }
                })
                .catch(err => {
                    Alert.alert(err.message);
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
