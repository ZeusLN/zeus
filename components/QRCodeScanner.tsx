import * as React from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    View,
    Platform,
    TouchableOpacity
} from 'react-native';
import { CameraScreen, Camera } from 'react-native-camera-kit';
import { launchImageLibrary } from 'react-native-image-picker';

const LocalQRCode = require('@remobile/react-native-qrcode-local-image');

import Button from './../components/Button';

import { localeString } from './../utils/LocaleUtils';

import FlashOffIcon from './../assets/images/SVG/Flash Off.svg';
import FlashOnIcon from './../assets/images/SVG/Flash On.svg';
import GalleryIcon from './../assets/images/SVG/Gallery.svg';
import ScanFrameSvg from './../assets/images/SVG/DynamicSVG/ScanFrameSvg';

const createHash = require('create-hash');

interface QRProps {
    text?: string;
    handleQRScanned: any;
    goBack: any;
}

interface QRState {
    cameraStatus: any;
    isTorchOn: boolean;
}

export default class QRCodeScanner extends React.Component<QRProps, QRState> {
    constructor(props: QRProps) {
        super(props);

        this.state = {
            cameraStatus: '',
            isTorchOn: false
        };
    }
    scannedCache: { [name: string]: number } = {};
    maskLength = (Dimensions.get('window').width * 80) / 100;

    CameraAuthStatus = Object.freeze({
        AUTHORIZED: 'AUTHORIZED',
        NOT_AUTHORIZED: 'NOT_AUTHORIZED',
        UNKNOWN: 'UNKNOWN'
    });

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

    handleOpenGallery = () => {
        launchImageLibrary(
            {
                mediaType: 'photo'
            },
            (response) => {
                if (!response.didCancel) {
                    const asset = response.assets[0];
                    if (asset.uri) {
                        const uri = asset.uri.toString().replace('file://', '');
                        LocalQRCode.decode(uri, (error: any, result: any) => {
                            if (!error) {
                                this.handleRead(result);
                            }
                        });
                    }
                }
            }
        );
    };
    onQRCodeScan = (event: { nativeEvent: { codeStringValue: any } }) => {
        this.handleRead(event.nativeEvent.codeStringValue);
    };

    toggleTorch = async () => {
        const { isTorchOn } = this.state;
        try {
            this.setState({ isTorchOn: !isTorchOn });
        } catch (error) {
            console.log('Error toggling torch: ', error);
        }
    };

    async componentDidMount() {
        if (Platform.OS !== 'ios' && Platform.OS !== 'macos') {
            return;
        }
        let isUserAuthorizedCamera;
        const isCameraAuthorized =
            await Camera.checkDeviceCameraAuthorizationStatus();
        switch (isCameraAuthorized) {
            case true:
                this.setState({
                    cameraStatus: this.CameraAuthStatus.AUTHORIZED
                });

                break;
            case false:
                this.setState({
                    cameraStatus: this.CameraAuthStatus.NOT_AUTHORIZED
                });
                isUserAuthorizedCamera =
                    await Camera.requestDeviceCameraAuthorization();
                if (isUserAuthorizedCamera) {
                    this.setState({
                        cameraStatus: this.CameraAuthStatus.NOT_AUTHORIZED
                    });
                }
                break;
            case -1:
                this.setState({
                    cameraStatus: this.CameraAuthStatus.UNKNOWN
                });
                isUserAuthorizedCamera =
                    await Camera.requestDeviceCameraAuthorization();
                if (isUserAuthorizedCamera) {
                    this.setState({
                        cameraStatus: this.CameraAuthStatus.AUTHORIZED
                    });
                }
                break;
        }
    }

    render() {
        const { cameraStatus, isTorchOn } = this.state;
        const { text, goBack } = this.props;

        return (
            <>
                {cameraStatus !== this.CameraAuthStatus.NOT_AUTHORIZED && (
                    <View
                        style={{
                            flex: 1
                        }}
                    >
                        <Camera
                            style={styles.preview}
                            scanBarcode={true}
                            torchMode={isTorchOn ? 'on' : 'off'}
                            onReadCode={this.onQRCodeScan}
                        />
                        <View style={styles.actionOverlay}>
                            <TouchableOpacity
                                style={styles.flashButton}
                                onPress={this.toggleTorch}
                            >
                                {isTorchOn ? (
                                    <FlashOnIcon width={35} height={35} />
                                ) : (
                                    <FlashOffIcon width={35} height={35} />
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={this.handleOpenGallery}>
                                <GalleryIcon width={50} height={50} />
                            </TouchableOpacity>
                        </View>
                        {text !== undefined && (
                            <Text style={styles.textOverlay}>{text}</Text>
                        )}
                        <View
                            style={[
                                styles.contentRow,
                                { height: this.maskLength }
                            ]}
                        >
                            <View style={styles.overlay} />
                            <View style={styles.scan}>
                                <ScanFrameSvg height="100%" />
                            </View>
                            <View style={styles.overlay} />
                        </View>
                        <View
                            style={{
                                flex: 1,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Button
                                title={localeString('general.cancel')}
                                onPress={() => goBack()}
                                iconOnly
                                noUppercase
                            />
                        </View>
                    </View>
                )}

                {cameraStatus === this.CameraAuthStatus.NOT_AUTHORIZED && (
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
    flashButton: {
        marginTop: 8,
        marginRight: 5
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    scan: {
        margin: 0
    },
    actionOverlay: {
        flexDirection: 'row',
        position: 'absolute',
        right: 10,
        top: '7%'
    },

    textOverlay: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: 'white',
        textAlign: 'center',
        fontSize: 15
    },
    contentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end'
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)'
    }
});
