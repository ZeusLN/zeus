import * as React from 'react';
import { Alert } from 'react-native';
import { inject, observer } from 'mobx-react';
import QRCodeScanner from './../components/QRCodeScanner';
import handleAnything from './../utils/handleAnything';

interface AddressQRProps {
    navigation: any;
}

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
        const { navigation } = this.props;
        handleAnything(data)
            .then(([route, props]) => {
                navigation.navigate(route, props);
            })
            .catch(err => {
                Alert.alert(
                    'Error',
                    err.message,
                    [{ text: 'OK', onPress: () => void 0 }],
                    { cancelable: false }
                );

                navigation.navigate('Send');
            });
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
