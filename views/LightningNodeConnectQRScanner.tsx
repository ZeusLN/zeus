import * as React from 'react';
import { Alert } from 'react-native';
import QRCodeScanner from './../components/QRCodeScanner';
import ConnectionFormatUtils from './../utils/ConnectionFormatUtils';
import { localeString } from './../utils/LocaleUtils';

interface LightningNodeConnectQRProps {
    navigation: any;
}

export default class LightningNodeConnectQRScanner extends React.Component<
    LightningNodeConnectQRProps,
    {}
> {
    handleLNCConfigScanned = (data: string) => {
        const { navigation } = this.props;

        const index = navigation.getParam('index', null);

        const { pairingPhrase, mailboxServer, customMailboxServer } =
            ConnectionFormatUtils.processLncUrl(data);

        if (pairingPhrase && mailboxServer) {
            navigation.navigate('NodeConfiguration', {
                node: {
                    pairingPhrase,
                    mailboxServer,
                    customMailboxServer,
                    implementation: 'lightning-node-connect'
                },
                index
            });
        } else {
            Alert.alert(
                localeString('general.error'),
                localeString('views.LncQRScanner.error'),
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );

            navigation.navigate('Settings');
        }
    };

    render() {
        const { navigation } = this.props;

        const index = navigation.getParam('index', null);

        return (
            <QRCodeScanner
                handleQRScanned={this.handleLNCConfigScanned}
                goBack={() =>
                    navigation.navigate('NodeConfiguration', { index })
                }
            />
        );
    }
}
