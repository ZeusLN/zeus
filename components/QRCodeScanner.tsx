import * as React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { RNCamera } from 'react-native-camera';
import Permissions, { PERMISSIONS, RESULTS } from 'react-native-permissions';

interface QRProps {
    title: string;
    text: string;
    handleQRScanned: any;
    goBack: any;
}

interface QRState {
    hasCameraPermission: boolean | null;
}

export default class QRCodeScanner extends React.Component<QRProps, QRState> {
    state = {
        hasCameraPermission: null
    };

    async componentDidMount() {
        if (Platform.OS === 'android') {
            await Permissions.request(PERMISSIONS.ANDROID.CAMERA).then(
                (response: any) => {
                    this.setState({
                        hasCameraPermission: response === RESULTS.GRANTED
                    });
                }
            );
        }
    }

    render() {
        const { hasCameraPermission } = this.state;
        const { title, text, handleQRScanned, goBack } = this.props;

        if (hasCameraPermission === null) {
            return <Text>Requesting for camera permission</Text>;
        }

        if (hasCameraPermission === false) {
            return <Text>No access to camera</Text>;
        }

        return (
            <React.Fragment>
                <Header
                    leftComponent={
                        <Icon
                            name="arrow-back"
                            onPress={goBack}
                            color="#fff"
                            underlayColor="transparent"
                        />
                    }
                    centerComponent={{ text: title, style: { color: '#fff' } }}
                    backgroundColor="grey"
                />
                <View style={styles.content}>
                    <Text>{text}</Text>
                </View>
                <RNCamera
                    onBarCodeRead={(ret: any) => handleQRScanned(ret.data)}
                    style={{
                        flex: 1
                    }}
                    androidCameraPermissionOptions={{
                        title: 'Permission to use camera',
                        message: 'We need your permission to use your camera',
                        buttonPositive: 'OK',
                        buttonNegative: 'Cancel'
                    }}
                    captureAudio={false}
                />
            </React.Fragment>
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
