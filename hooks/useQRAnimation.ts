import { useState, useEffect, useRef, useCallback } from 'react';
import { UR } from '@ngraveio/bc-ur';
import UREncoder from '@ngraveio/bc-ur/dist/urEncoder';

interface BCUREncoder {
    nextPart(): string;
}
import { CryptoPSBT } from '@keystonehq/bc-ur-registry';

import Base64Utils from '../utils/Base64Utils';
import { DEFAULT_SPLIT_OPTIONS, splitQRs } from '../utils/BbqrUtils';
import {
    getQRAnimationInterval,
    QRAnimationSpeed
} from '../utils/QRAnimationUtils';

export type QREncoderType = 'psbt' | 'transaction' | 'generic';
export type BBQrFileType = 'P' | 'T' | 'U'; // PSBT, Transaction, Unicode

interface UseQRAnimationOptions {
    data: string;
    encoderType: QREncoderType;
    fileType: BBQrFileType;
    initialSpeed?: QRAnimationSpeed;
}

interface UseQRAnimationResult {
    frameIndex: number;
    bbqrParts: string[];
    bcurPart: string;
    qrAnimationSpeed: QRAnimationSpeed;
    setQRAnimationSpeed: (speed: QRAnimationSpeed) => void;
    isMultiFrame: boolean;
}

export const useQRAnimation = ({
    data,
    encoderType,
    fileType,
    initialSpeed = 'medium'
}: UseQRAnimationOptions): UseQRAnimationResult => {
    const [frameIndex, setFrameIndex] = useState(0);
    const [bbqrParts, setBbqrParts] = useState<string[]>([]);
    const [bcurPart, setBcurPart] = useState('');
    const [qrAnimationSpeed, setQRAnimationSpeed] =
        useState<QRAnimationSpeed>(initialSpeed);

    const bcurEncoderRef = useRef<BCUREncoder | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const generateInfo = useCallback(() => {
        if (!data) return;

        // BBQr encoding
        const input = Base64Utils.base64ToBytes(data);
        const splitResult = splitQRs(input, fileType, DEFAULT_SPLIT_OPTIONS);
        setBbqrParts(splitResult.parts);

        // BC-UR encoding
        const maxFragmentLength = 200;
        const firstSeqNum = 0;

        if (encoderType === 'psbt') {
            const messageBuffer = Buffer.from(data, 'base64');
            const cryptoPSBT = new CryptoPSBT(messageBuffer);
            bcurEncoderRef.current = cryptoPSBT.toUREncoder(
                maxFragmentLength,
                firstSeqNum
            );
        } else {
            const messageBuffer =
                encoderType === 'generic'
                    ? Buffer.from(data, 'utf-8')
                    : Buffer.from(data, 'hex');
            const ur = UR.fromBuffer(messageBuffer);
            bcurEncoderRef.current = new UREncoder(
                ur,
                maxFragmentLength,
                firstSeqNum
            );
        }

        // Set initial bcurPart
        if (bcurEncoderRef.current) {
            const part = bcurEncoderRef.current.nextPart();
            setBcurPart(encoderType === 'psbt' ? part.toUpperCase() : part);
        }

        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Start animation interval
        const length = splitResult.parts.length;
        const interval = getQRAnimationInterval(qrAnimationSpeed);

        intervalRef.current = setInterval(() => {
            setFrameIndex((prev) => (prev === length - 1 ? 0 : prev + 1));
            if (bcurEncoderRef.current) {
                const part = bcurEncoderRef.current.nextPart();
                setBcurPart(encoderType === 'psbt' ? part.toUpperCase() : part);
            }
        }, interval);
    }, [data, encoderType, fileType, qrAnimationSpeed]);

    // Generate info when data or speed changes
    useEffect(() => {
        generateInfo();
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [generateInfo]);

    return {
        frameIndex,
        bbqrParts,
        bcurPart,
        qrAnimationSpeed,
        setQRAnimationSpeed,
        isMultiFrame: bbqrParts.length > 1
    };
};
