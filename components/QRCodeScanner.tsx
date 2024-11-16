import { useCallback, useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    BackHandler,
    AppState,
    Alert
} from 'react-native';
import {
    Camera,
    Point,
    useCameraDevice,
    useCodeScanner
} from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { StackNavigationProp } from '@react-navigation/stack';

const LocalQRCode = require('../zeus_modules/@remobile/react-native-qrcode-local-image');

import Header from './Header';
import Button from '../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import FlashOffIcon from '../assets/images/SVG/Flash Off.svg';
import FlashOnIcon from '../assets/images/SVG/Flash On.svg';
import GalleryIcon from '../assets/images/SVG/Gallery.svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const createHash = require('create-hash');

interface QRProps {
    text?: string;
    handleQRScanned: (data: string) => void;
    goBack: any;
    navigation: StackNavigationProp<any, any>;
    parts?: number;
    totalParts?: number;
    mode?: string;
}

const CameraAuthStatus = Object.freeze({
    AUTHORIZED: 'AUTHORIZED',
    NOT_AUTHORIZED: 'NOT_AUTHORIZED',
    UNKNOWN: 'UNKNOWN'
});

export default function QRCodeScanner({
    text,
    handleQRScanned,
    goBack,
    navigation,
    parts,
    totalParts,
    mode
}: QRProps) {
    const [cameraStatus, setCameraStatus] = useState<string>(
        CameraAuthStatus.UNKNOWN
    );
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [scannedCache, setScannedCache] = useState(new Set<string>());
    const [cameraIsActive, setCameraIsActive] = useState(true);

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
        if (scannedCache.has(hash)) {
            // this QR was already scanned, let's prevent firing duplicate callbacks
            return;
        }
        scannedCache.add(hash);
        handleQRScanned(data);
    };

    const handleOpenGallery = () => {
        launchImageLibrary({ mediaType: 'photo' }, (response) => {
            if (!response.didCancel) {
                const asset = response.assets?.[0];
                if (asset?.uri) {
                    const uri = asset.uri?.replace('file://', '');
                    LocalQRCode.decode(uri, (error: any, result: any) => {
                        if (!error) {
                            handleRead(result);
                        } else {
                            console.error('Error decoding QR code:', error);
                            Alert.alert(
                                localeString('general.error'),
                                localeString(
                                    'components.QRCodeScanner.notRecognized'
                                ),
                                undefined,
                                { cancelable: true }
                            );
                        }
                    });
                }
            }
        });
    };

    const codeScanner = useCodeScanner({
        codeTypes: ['qr'],
        onCodeScanned: (codes) => {
            const code = codes.find((c) => c.value != null)?.value;
            if (code != null) {
                handleRead(code);
            }
        }
    });

    const toggleTorch = async () => {
        try {
            setIsTorchOn(!isTorchOn);
        } catch (error) {
            console.error('Error toggling torch:', error);
        }
    };

    const handleFocus = () => setScannedCache(new Set<string>());

    useEffect(() => {
        (async () => {
            // triggers when loaded from navigation or back action
            navigation.addListener('focus', handleFocus);
            const appStateChangeSubscription = AppState.addEventListener(
                'change',
                (state) => setCameraIsActive(state === 'active')
            );

            const hasPermission = Camera.getCameraPermissionStatus();
            if (hasPermission === 'granted') {
                setCameraStatus(CameraAuthStatus.AUTHORIZED);
            } else {
                const result = await Camera.requestCameraPermission();
                if (result === 'granted') {
                    setCameraStatus(CameraAuthStatus.AUTHORIZED);
                } else {
                    setCameraStatus(CameraAuthStatus.NOT_AUTHORIZED);
                }
            }

            return () => {
                navigation.removeListener('focus', handleFocus);
                appStateChangeSubscription.remove();
            };
        })();
    }, []);

    const camera = useRef<Camera>(null);

    const focusCamera = useCallback(
        (point: Point) => camera.current?.focus(point),
        []
    );

    const gesture = Gesture.Tap().onEnd(({ x, y }) =>
        runOnJS(focusCamera)({ x, y })
    );

    const hasPartsCount = parts && totalParts;

    return (
        <>
            {device && cameraStatus === CameraAuthStatus.AUTHORIZED && (
                <View
                    style={{ flex: 1 }}
                    accessibilityLabel={localeString('general.scan')}
                >
                    <GestureDetector gesture={gesture}>
                        <Camera
                            ref={camera}
                            style={StyleSheet.absoluteFill}
                            device={device}
                            codeScanner={codeScanner}
                            torch={isTorchOn ? 'on' : 'off'}
                            isActive={cameraIsActive}
                            enableZoomGesture={true}
                            onError={(error) =>
                                console.error('Camera error:', error)
                            }
                        />
                    </GestureDetector>
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
                                {device.hasFlash && (
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

            {device && cameraStatus === CameraAuthStatus.NOT_AUTHORIZED && (
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
