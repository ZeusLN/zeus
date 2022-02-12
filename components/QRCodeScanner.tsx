import * as React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { RNCamera } from 'react-native-camera';

import Button from './../components/Button';

import { localeString } from './../utils/LocaleUtils';

import Scan from './../assets/images/SVG/ScanFrame.svg';

const createHash = require('create-hash');

interface QRProps {
    text?: string;
    handleQRScanned: any;
    goBack: any;
}

interface QRState {
    cameraStatus: any;
}

export default class QRCodeScanner extends React.Component<QRProps, QRState> {
    constructor() {
        super();
        const { width } = Dimensions.get('window');
        this.maskLength = (width * 80) / 100;
    }
    scannedCache: any = {};
    state = {
        cameraStatus: null
    };

    handleCameraStatusChange = (event: any) => {
        this.setState({
            cameraStatus: event.cameraStatus
        });
    };

    handleRead = (data: any) => {
        const hash = createHash('sha256').update(data).digest().toString('hex');
        if (this.scannedCache[hash]) {
            // this QR was already scanned let's prevent firing duplicate
            // callbacks
            return;
        }
        this.scannedCache[hash] = +new Date();
        this.props.handleQRScanned(data);
    };

    render() {
        const { cameraStatus } = this.state;
        const { text, goBack } = this.props;

        return (
            <>
                {cameraStatus !==
                    RNCamera.Constants.CameraStatus.NOT_AUTHORIZED && (
                    <View
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center'
                        }}
                    >
                        <RNCamera
                            style={styles.preview}
                            onBarCodeRead={(ret: any) =>
                                this.handleRead(ret.data)
                            }
                            androidCameraPermissionOptions={{
                                title: localeString(
                                    'components.QRCodeScanner.cameraPermissionTitle'
                                ),
                                message: localeString(
                                    'components.QRCodeScanner.cameraPermission'
                                ),
                                buttonPositive: localeString('general.ok'),
                                buttonNegative: localeString('general.cancel')
                            }}
                            captureAudio={false}
                            onStatusChange={this.handleCameraStatusChange}
                            barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}
                        >
                            <View style={styles.overlay} />
                            <Text style={styles.textOverlay}>{text}</Text>
                            <View
                                style={[
                                    styles.contentRow,
                                    { height: this.maskLength }
                                ]}
                            >
                                <View style={styles.overlay} />
                                <View style={styles.scan}>
                                    <Scan height="100%" />
                                </View>
                                <View style={styles.overlay} />
                            </View>
                            <View style={styles.overlay} />
                            <View style={styles.buttonOverlay}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() => goBack()}
                                    iconOnly
                                />
                            </View>
                        </RNCamera>
                    </View>
                )}
                {cameraStatus ===
                    RNCamera.Constants.CameraStatus.NOT_AUTHORIZED && (
                    <View style={styles.content}>
                        <Text
                            style={{
                                fontFamily: 'Lato-Regular',
                                textAlign: 'center',
                                padding: 15
                            }}
                        >
                            {localeString(
                                'components.QRCodeScanner.noCameraAccess'
                            )}
                        </Text>
                        <Button
                            title={localeString('general.goBack')}
                            onPress={() => goBack()}
                            secondary
                            containerStyle={{ width: 200 }}
                            adaptiveWidth
                        />
                    </View>
                )}
            </>
        );
    }
}

const styles = StyleSheet.create({
    preview: {
        flex: 1
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    scan: {
        margin: 0
    },
    buttonOverlay: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingBottom: 50
    },
    textOverlay: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: 'white',
        paddingBottom: 60,
        textAlign: 'center',
        fontSize: 15,
        padding: 30
    },
    contentRow: {
        flexDirection: 'row'
    },
    content: {
        flex: 1,
        justifyContent: 'center'
    }
});
