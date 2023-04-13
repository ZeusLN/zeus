import * as React from 'react';
import { Alert } from 'react-native';
import { observer } from 'mobx-react';

import QRCodeScanner from './../components/QRCodeScanner';

import handleAnything from './../utils/handleAnything';
import { localeString } from './../utils/LocaleUtils';

interface handleAnythingQRProps {
    navigation: any;
}

@observer
export default class handleAnythingQRScanner extends React.Component<
    handleAnythingQRProps,
    {}
> {
    constructor(props: any) {
        super(props);

        this.state = {
            useInternalScanner: false
        };
    }

    handleAnythingScanned = (data: string) => {
        const { navigation } = this.props;
        handleAnything(data)
            .then((response) => {
                if (response) {
                    const [route, props] = response;
                    navigation.navigate(route, props);
                } else {
                    navigation.goBack();
                }
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

                navigation.goBack();
            });
    };

    render() {
        const { navigation } = this.props;

        return (
            <QRCodeScanner
                handleQRScanned={this.handleAnythingScanned}
                goBack={() => navigation.goBack()}
                navigation={navigation}
            />
        );
    }
}
