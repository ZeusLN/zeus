import * as React from 'react';
import { Alert } from 'react-native';
import { Icon } from 'react-native-elements';
import QRCodeScanner from './../components/QRCodeScanner';

interface NodeQRProps {
    navigation: any;
}

export default class NodeQRScanner extends React.Component<NodeQRProps, {}> {
    handleNodeScanned = ({ data }: any) => {
        const { navigation } = this.props;

        if (data.includes('@') && data.includes(':')) {
            const node_pubkey_string = data.split('@')[0];
            const host = data.split('@')[1];
            navigation.navigate('OpenChannel', { node_pubkey_string, host });
        } else {
            Alert.alert(
                'Error',
                'Scanned QR code was not a valid Lightning Node',
                [
                    {text: 'OK', onPress: () => void(0)}
                ],
                {cancelable: false}
            );

            navigation.navigate('OpenChannel');
        }
    }
    render() {
        const { navigation } = this.props;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('OpenChannel')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <QRCodeScanner
                title="Lightning Node QR Scanner"
                text="Scan a valid Lightning Node"
                handleQRScanned={this.handleNodeScanned}
                BackButton={BackButton}
            />
        );
    }
}