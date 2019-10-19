import * as React from 'react';
import { Alert } from 'react-native';
import QRCodeScanner from './../components/QRCodeScanner';
import NodeUriUtils from './../utils/NodeUriUtils';

interface NodeQRProps {
    navigation: any;
}

export default class NodeQRScanner extends React.Component<NodeQRProps, {}> {
    handleNodeScanned = (data: string) => {
        const { navigation } = this.props;

        if (NodeUriUtils.isValidNodeUri(data)) {
            const { pubkey, host } = NodeUriUtils.processNodeUri(data);
            navigation.navigate('OpenChannel', { node_pubkey_string: pubkey, host });
        } else {
            Alert.alert(
                'Error',
                'Scanned QR code was not a valid Lightning Node',
                [{ text: 'OK', onPress: () => void 0 }],
                { cancelable: false }
            );

            navigation.navigate('OpenChannel');
        }
    };
    render() {
        const { navigation } = this.props;

        return (
            <QRCodeScanner
                title="Lightning Node QR Scanner"
                text="Scan a valid Lightning Node"
                handleQRScanned={this.handleNodeScanned}
                goBack={() => navigation.navigate('OpenChannel')}
            />
        );
    }
}
