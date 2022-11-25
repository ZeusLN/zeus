import * as React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BarCodeReadEvent, FlashMode, RNCamera } from 'react-native-camera';

import Button from './../components/Button';

import { localeString } from './../utils/LocaleUtils';

import FlashOffIcon from './../assets/images/SVG/Flash Off.svg';
import FlashOnIcon from './../assets/images/SVG/Flash On.svg';
import Scan from './../assets/images/SVG/ScanFrame.svg';

const createHash = require('create-hash');

interface QRProps {
    text?: string;
    handleQRScanned: any;
    goBack: any;
}

interface QRState {
    cameraStatus: any;
    torch: FlashMode;
}

export default class QRCodeScanner extends React.Component<QRProps, QRState> {
    constructor(props: QRProps) {
        super(props);

        this.state = {
            cameraStatus: null,
            torch: RNCamera.Constants.FlashMode.off
        };
    }
    scannedCache: { [name: string]: number } = {};
    maskLength = (Dimensions.get('window').width * 80) / 100;

    handleCameraStatusChange = (event: any) => {
        this.setState((state) => {
            return {
                ...state,
                cameraStatus: event.cameraStatus
            };
        });
    };

    handleFlash = () => {
        this.setState((state) => {
            return {
                ...state,
                torch:
                    this.state.torch === RNCamera.Constants.FlashMode.torch
                        ? RNCamera.Constants.FlashMode.off
                        : RNCamera.Constants.FlashMode.torch
            };
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
                            onBarCodeRead={(ret: BarCodeReadEvent) =>
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
                            flashMode={
                                this.state.cameraStatus ===
                                RNCamera.Constants.CameraStatus.READY
                                    ? this.state.torch
                                    : RNCamera.Constants.FlashMode.off
                            }
                        >
                            <View style={styles.overlay} />
                            <View style={styles.flashlightOverlay}>
                                {this.state.torch ===
                                RNCamera.Constants.FlashMode.torch ? (
                                    <FlashOnIcon onPress={this.handleFlash} />
                                ) : (
                                    <FlashOffIcon onPress={this.handleFlash} />
                                )}
                            </View>
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
                                    noUppercase
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
    flashlightOverlay: {
        display: 'flex',
        flexDirection: 'row-reverse',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingLeft: 20
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
