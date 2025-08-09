export const QR_ANIMATION_SPEEDS = {
    fast: 1000,
    medium: 2000,
    slow: 4000
} as const;

export type QRAnimationSpeed = keyof typeof QR_ANIMATION_SPEEDS;

export const getQRAnimationInterval = (
    speed: QRAnimationSpeed = 'fast'
): number => {
    return QR_ANIMATION_SPEEDS[speed];
};
