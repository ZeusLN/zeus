// Longest payload that fits in a single QR code: version 40 byte-mode holds
// 2331 bytes at ECC level M (react-native-qrcode-svg's default). Longer data
// must be displayed as animated BC-ur/BBQr frames.
export const SINGLE_FRAME_QR_MAX_LEN = 2300;

export const QR_ANIMATION_SPEEDS = {
    fast: 250,
    medium: 1000,
    slow: 2000
} as const;

export type QRAnimationSpeed = keyof typeof QR_ANIMATION_SPEEDS;

export const getQRAnimationInterval = (
    speed: QRAnimationSpeed = 'fast'
): number => {
    return QR_ANIMATION_SPEEDS[speed];
};
