import { useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    BackHandler,
    AppState,
    Alert,
    Linking
} from 'react-native';
import {
    Camera,
    useCameraDevice,
    useCameraPermission
} from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import type { TargetBarcodeFormat } from 'react-native-vision-camera-barcode-scanner';
import { launchImageLibrary } from 'react-native-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import QRKit from 'react-native-qr-kit';

import Header from './Header';
import Button from '../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import FlashOffIcon from '../assets/images/SVG/Flash Off.svg';
import FlashOnIcon from '../assets/images/SVG/Flash On.svg';
import GalleryIcon from '../assets/images/SVG/Gallery.svg';

const createHash = require('create-hash');

// Hoisted: useBarcodeScannerOutput memoizes on the identity of this array, so
// an inline literal would tear down and recreate the native output every render.
const BARCODE_FORMATS: TargetBarcodeFormat[] = ['qr-code'];

interface QRProps {
    text?: string;
    handleQRScanned: (data: string) => void;
    goBack: any;
    navigation: NativeStackNavigationProp<any, any>;
    parts?: number;
    totalParts?: number;
    mode?: string;
}

export default function QRCodeScanner({
    text,
    handleQRScanned,
    goBack,
    navigation,
    parts,
    totalParts,
    mode
}: QRProps) {
    const [isTorchOn, setIsTorchOn] = useState(false);
    const scannedCache = useRef(new Set<string>());
    const [cameraIsActive, setCameraIsActive] = useState(true);

    // useCameraPermission re-reads the status whenever the app returns to the
    // foreground, so returning from the system settings picks up a new grant.
    const { hasPermission, canRequestPermission, requestPermission } =
        useCameraPermission();

    useEffect(() => {
        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                goBack();
                return true;
            }
        );

        return () => backHandler.remove();
    }, []);

    const device = useCameraDevice('back');

    const handleRead = (data: any) => {
        const hash = createHash('sha256').update(data).digest().toString('hex');
        if (scannedCache.current.has(hash)) {
            // this QR was already scanned, let's prevent firing duplicate callbacks
            return;
        }
        scannedCache.current.add(hash);
        handleQRScanned(data);
    };

    const handleOpenGallery = () => {
        launchImageLibrary(
            { mediaType: 'photo', includeBase64: true },
            async (response) => {
                if (!response.didCancel) {
                    const asset = response.assets?.[0];
                    if (asset?.base64) {
                        const result = await QRKit.decodeBase64(asset.base64);
                        if (result?.success && result.data) {
                            handleRead(result.data);
                        } else {
                            Alert.alert(
                                localeString('general.error'),
                                localeString(
                                    'components.QRCodeScanner.notRecognized'
                                ),
                                undefined,
                                { cancelable: true }
                            );
                        }
                    }
                }
            }
        );
    };

    const codeScannerOutput = useBarcodeScannerOutput({
        barcodeFormats: BARCODE_FORMATS,
        // 'preview' (the default) decodes preview-sized buffers, which loses the
        // detail needed for dense invoices and codes held away from the lens.
        // 'full' analyses the highest-resolution buffers the session can supply.
        outputResolution: 'full',
        onBarcodeScanned: (barcodes) => {
            const code = barcodes.find((b) => b.rawValue != null)?.rawValue;
            if (code != null) {
                handleRead(code);
            }
        },
        onError: (error) => console.error('Barcode scanner error:', error)
    });

    const toggleTorch = async () => {
        try {
            setIsTorchOn(!isTorchOn);
        } catch (error) {
            console.error('Error toggling torch:', error);
        }
    };

    const handleFocus = () => scannedCache.current.clear();

    useEffect(() => {
        // triggers when loaded from navigation or back action
        navigation.addListener('focus', handleFocus);
        const appStateChangeSubscription = AppState.addEventListener(
            'change',
            (state) => setCameraIsActive(state === 'active')
        );

        return () => {
            navigation.removeListener('focus', handleFocus);
            appStateChangeSubscription.remove();
        };
    }, []);

    useEffect(() => {
        if (!hasPermission && canRequestPermission) {
            requestPermission();
        }
    }, [hasPermission, canRequestPermission, requestPermission]);

    const hasPartsCount = parts && totalParts;

    return (
        <>
            {device && hasPermission && (
                <View
                    style={{ flex: 1 }}
                    accessibilityLabel={localeString('general.scan')}
                >
                    <Camera
                        style={StyleSheet.absoluteFill}
                        device={device}
                        outputs={[codeScannerOutput]}
                        torchMode={isTorchOn ? 'on' : 'off'}
                        isActive={cameraIsActive}
                        enableNativeZoomGesture
                        enableNativeTapToFocusGesture
                        onError={(error) =>
                            console.error('Camera error:', error)
                        }
                    />
                    <Header
                        leftComponent="Back"
                        onBack={() => goBack()}
                        navigateBackOnBackPress={false}
                        centerComponent={
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('text'),
                                    fontSize: 16
                                }}
                            >
                                {mode === 'default'
                                    ? ''
                                    : hasPartsCount
                                    ? `${mode}: ${parts} / ${totalParts}`
                                    : mode}
                            </Text>
                        }
                        rightComponent={
                            <View style={styles.actionOverlay}>
                                {device.hasTorch && (
                                    <TouchableOpacity
                                        style={styles.flashButton}
                                        onPress={toggleTorch}
                                    >
                                        {isTorchOn ? (
                                            <View
                                                accessibilityLabel={localeString(
                                                    'components.QRCodeScanner.flashOn'
                                                )}
                                            >
                                                <FlashOnIcon
                                                    width={30}
                                                    height={30}
                                                    fill={themeColor('text')}
                                                />
                                            </View>
                                        ) : (
                                            <View
                                                accessibilityLabel={localeString(
                                                    'components.QRCodeScanner.flashOff'
                                                )}
                                            >
                                                <FlashOffIcon
                                                    width={30}
                                                    height={30}
                                                    fill={themeColor('text')}
                                                />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={handleOpenGallery}
                                    accessibilityLabel={localeString(
                                        'components.QRCodeScanner.chooseFromGallery'
                                    )}
                                >
                                    <GalleryIcon
                                        width={30}
                                        height={30}
                                        fill={themeColor('text')}
                                    />
                                </TouchableOpacity>
                            </View>
                        }
                        containerStyle={{
                            backgroundColor: themeColor('background')
                        }}
                    />
                    {text !== undefined && (
                        <Text style={styles.textOverlay}>{text}</Text>
                    )}
                </View>
            )}

            {device && !hasPermission && !canRequestPermission && (
                <View style={styles.content}>
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            textAlign: 'center',
                            padding: 15,
                            color: 'white'
                        }}
                    >
                        {localeString(
                            'components.QRCodeScanner.noCameraAccess'
                        )}
                    </Text>
                    <Button
                        title={localeString(
                            'components.QRCodeScanner.openSettings'
                        )}
                        onPress={() => Linking.openSettings()}
                        containerStyle={{ width: 200, marginBottom: 10 }}
                        adaptiveWidth
                    />
                    <Button
                        title={localeString('general.goBack')}
                        onPress={() => goBack()}
                        secondary
                        containerStyle={{ width: 200 }}
                        adaptiveWidth
                    />
                </View>
            )}

            {!device && (
                <View style={styles.content}>
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            textAlign: 'center',
                            padding: 15,
                            color: 'white'
                        }}
                    >
                        {localeString('components.QRCodeScanner.noCameraFound')}
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

const styles = StyleSheet.create({
    preview: {
        flex: 1
    },
    flashButton: {
        marginRight: 15
    },
    actionOverlay: {
        flexDirection: 'row'
    },
    textOverlay: {
        fontFamily: 'PPNeueMontreal-Book',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        textAlign: 'center',
        fontSize: 15,
        paddingVertical: 5
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
    }
});
