declare module 'react-native-qr-kit' {
    interface DecodeResult {
        success: boolean;
        data?: string;
        message?: string;
    }

    interface QRKit {
        decodeBase64(base64String: string): Promise<DecodeResult>;
    }

    const QRKit: QRKit;
    export default QRKit;
}
