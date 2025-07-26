import { localeString } from './LocaleUtils';

import Turtle from '../assets/images/SVG/Turtle.svg';
import Rabbit from '../assets/images/SVG/Rabbit.svg';
import Gazelle from '../assets/images/SVG/Gazelle.svg';

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

export const QR_ANIMATION_SPEED_OPTIONS = [
    {
        key: localeString('views.Settings.Display.qrAnimationSpeed.slow'),
        value: 'slow',
        icon: Turtle
    },
    {
        key: localeString('views.Settings.Display.qrAnimationSpeed.medium'),
        value: 'medium',
        icon: Rabbit
    },
    {
        key: localeString('views.Settings.Display.qrAnimationSpeed.fast'),
        value: 'fast',
        icon: Gazelle
    }
];
