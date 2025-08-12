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
