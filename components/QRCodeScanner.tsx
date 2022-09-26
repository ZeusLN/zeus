import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { useScanBarcodes, BarcodeFormat } from 'vision-camera-code-scanner';

import Button from './../components/Button';

import { localeString } from './../utils/LocaleUtils';

import Scan from './../assets/images/SVG/ScanFrame.svg';

const createHash = require('create-hash');

interface QRProps {
    text?: string;
    handleQRScanned: any;
    goBack: any;
}

export default function QRCodeScanner({
    handleQRScanned,
    goBack,
    text
}: QRProps) {
    const [hasPermission, setHasPermission] = useState(false);
    const devices = useCameraDevices();
    const device = devices.back;
    const scannedCache: any = {};

    const [frameProcessor, barcodes] = useScanBarcodes(
        [BarcodeFormat.QR_CODE],
        {
            checkInverted: true
        }
    );

    const handleRead = (data: string) => {
        const hash = createHash('sha256').update(data).digest().toString('hex');
        if (scannedCache[hash]) {
            // this QR was already scanned let's prevent firing duplicate
            // callbacks
            return;
        }
        scannedCache[hash] = +new Date();
        handleQRScanned(data);
    };

    useEffect(() => {
        (async () => {
            const status = await Camera.requestCameraPermission();
            setHasPermission(status === 'authorized');
        })();
    }, []);

    useEffect(() => {
        barcodes.map((barcode) => {
            handleRead(barcode.content.data);
        });
    }, [barcodes]);

    return (
        <>
            {hasPermission && (
                <View
                    style={{
                        flex: 1
                    }}
                >
                    {device != null && hasPermission && (
                        <>
                            <Camera
                                style={StyleSheet.absoluteFill}
                                device={device}
                                isActive={true}
                                frameProcessor={frameProcessor}
                                frameProcessorFps={5}
                            />
                            {!!text && (
                                <Text style={styles.textOverlay}>{text}</Text>
                            )}
                            <View style={styles.scan}>
                                <Scan height="100%" />
                            </View>
                            <View style={styles.buttonOverlay}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() => goBack()}
                                    iconOnly
                                    noUppercase
                                />
                            </View>
                        </>
                    )}
                </View>
            )}
            {!hasPermission && (
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

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    scan: {
        flex: 1,
        alignSelf: 'center',
        justifyContent: 'center'
    },
    buttonOverlay: {
        position: 'absolute',
        bottom: 10,
        height: 100,
        padding: 10,
        alignSelf: 'center',
        width: '100%'
    },
    textOverlay: {
        position: 'absolute',
        top: 110,
        height: 100,
        padding: 10,
        alignSelf: 'center',
        width: '100%',
        textAlign: 'center'
    },
    content: {
        flex: 1,
        justifyContent: 'center'
    }
});
