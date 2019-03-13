import * as React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Header } from 'react-native-elements';
import { CameraKitCameraScreen } from 'react-native-camera-kit';
import Permissions from 'react-native-permissions';

interface QRProps {
    title: string;
    text: string;
    handleQRScanned: any;
    BackButton: any;
}

interface QRState {
    hasCameraPermission: boolean | null;
}

export default class QRCodeScanner extends React.Component<QRProps, QRState> {
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
        const { title, text, handleQRScanned, BackButton } = this.props;

        if (hasCameraPermission === null) {
            return <Text>Requesting for camera permission</Text>;
        }

        if (hasCameraPermission === false) {
            return <Text>No access to camera</Text>;
        }

        return (
            <View>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: title, style: { color: '#fff' } }}
                    backgroundColor='grey'
                />
                <View style={styles.content}>
                    <Text>{text}</Text>
                </View>
                <CameraKitCameraScreen
                    laserColor={"orange"}
                    frameColor={"yellow"}
                    scanBarcode={true}
                    onReadCode={(event: any) => handleQRScanned(event.nativeEvent.codeStringValue)}
                    hideControls={false}
                    showFrame={true}
                    heightForScannerFrame={300}
                />
            </View>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        alignItems: 'center',
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 10,
        paddingTop: 5
    }
});