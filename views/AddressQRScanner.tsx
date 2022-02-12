import * as React from 'react';
import { Alert } from 'react-native';
import { observer } from 'mobx-react';

import QRCodeScanner from './../components/QRCodeScanner';

import handleAnything from './../utils/handleAnything';
import { localeString } from './../utils/LocaleUtils';

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
            .catch((err) => {
                Alert.alert(
                    localeString('general.error'),
                    err.message,
                    [
                        {
                            text: localeString('general.ok'),
                            onPress: () => void 0
                        }
                    ],
                    { cancelable: false }
                );

                navigation.navigate('Send');
            });
    };

    render() {
        const { navigation } = this.props;

        return (
            <QRCodeScanner
                handleQRScanned={this.handleAddressInvoiceScanned}
                goBack={() => navigation.goBack()}
            />
        );
    }
}
