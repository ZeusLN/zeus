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
// import Permissions, { PERMISSIONS, RESULTS } from 'react-native-permissions';

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
    cameraAuthorized: any;
    isCameraOpen: boolean;
    qrCodeData: string;
    flashMode: any;
}

export default class QRCodeScanner extends React.Component<QRProps, QRState> {
    constructor(props: QRProps) {
        super(props);

        this.state = {
            cameraAuthorized: false,
            isCameraOpen: false,
            qrCodeData: '',
            flashMode: 'off'
        };
    }
    scannedCache: { [name: string]: number } = {};
    maskLength = (Dimensions.get('window').width * 80) / 100;

    toggleFlash = () => {
        const { flashMode } = this.state;
        this.setState({ flashMode: flashMode === 'torch' ? 'off' : 'torch' });
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

    render() {
        const { text, goBack } = this.props;

        return (
            <View style={styles.container}>
                <CameraScreen
                    scanBarcode={true}
                    onReadCode={this.onQRCodeScan}
                    torchOnImage={<FlashOnIcon width={35} height={35} />}
                    torchOffImage={<FlashOffIcon width={35} height={35} />}
                    torchImageStyle={{
                        marginTop: 8,
                        marginRight: 5,
                        borderColor: 'red'
                    }}
                />

                <View style={styles.actionOverlay}>
                    <TouchableOpacity onPress={this.handleOpenGallery}>
                        <GalleryIcon width={50} height={50} />
                    </TouchableOpacity>
                </View>
                {text !== undefined && (
                    <Text style={styles.textOverlay}>{text}</Text>
                )}

                <View style={[styles.contentRow, { height: this.maskLength }]}>
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
        );
    }
}

const styles = StyleSheet.create({
    container: {
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
        justifyContent: 'center'
    }
});
