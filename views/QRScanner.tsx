import * as React from 'react';
import { Alert, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import Camera from 'react-native-camera';
import Permissions from 'react-native-permissions';
import AddressUtils from './../utils/AddressUtils';
import { inject, observer } from 'mobx-react';

import NodeInfoStore from './../stores/NodeInfoStore';

interface QRProps {
    navigation: any;
    NodeInfoStore: NodeInfoStore;
}

interface QRState {
    hasCameraPermission: boolean | null;
}

@inject('NodeInfoStore')
@observer
export default class QRScanner extends React.Component<QRProps, QRState> {
    state = {
        hasCameraPermission: null
    }

    async componentDidMount() {
        await Permissions.request('camera').then((response: any) => {
            this.setState({ hasCameraPermission: response === 'authorized' });
        });
    }

    render() {
        const { hasCameraPermission } = this.state;
        const { navigation } = this.props;

        if (hasCameraPermission === null) {
            return <Text>Requesting for camera permission</Text>;
        }

        if (hasCameraPermission === false) {
            return <Text>No access to camera</Text>;
        }

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Send')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'QR Code Scanner', style: { color: '#fff' } }}
                    backgroundColor='grey'
                />
                <View style={styles.content}>
                    <Camera onBarCodeRead={(ret: any) => this.handleQRScanned(ret)}>
                        <TouchableOpacity
                            style={{ marginTop: 600, width: 300 }}
                        ></TouchableOpacity>
                    </Camera>
                    <Text>Scan a valid Bitcoin address or Lightning invoice</Text>
                </View>
            </View>
        );
    }

    handleQRScanned = ({ data }: any) => {
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
}

const styles = StyleSheet.create({
    content: {
        alignItems: 'center',
        paddingLeft: 20,
        paddingRight: 20
    }
});