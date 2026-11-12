module.exports = {
    project: {
        ios: {
            automaticPodsInstallation: false
        },
        android: {}
    },
    dependencies: {
        // The barcode scanner depends on Google MLKit, which ships no arm64
        // simulator slice and forces EXCLUDED_ARCHS=arm64 for simulator
        // builds. iOS scans QR codes with VisionCamera's object output
        // (AVFoundation) instead; see hooks/useQRCodeOutput.ios.ts.
        'react-native-vision-camera-barcode-scanner': {
            platforms: { ios: null }
        }
    },
    assets: ['./assets']
};
