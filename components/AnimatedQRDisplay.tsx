import * as React from 'react';
import { View } from 'react-native';

import CollapsedQR from './CollapsedQR';
import QRFormatSelector from './QRFormatSelector';

import {
    useQRAnimation,
    QREncoderType,
    BBQrFileType
} from '../hooks/useQRAnimation';
import { SINGLE_FRAME_QR_MAX_LEN } from '../utils/QRAnimationUtils';

interface AnimatedQRDisplayProps {
    data: string;
    encoderType: QREncoderType;
    fileType: BBQrFileType;
    copyValue?: string;
    valuePrefix?: string;
    hideSingleFrame?: boolean;
    onShareGiftLink?: () => void;
}

const AnimatedQRDisplay: React.FC<AnimatedQRDisplayProps> = ({
    data,
    encoderType,
    fileType,
    copyValue,
    valuePrefix = '',
    hideSingleFrame = false,
    onShareGiftLink
}) => {
    const [selectedIndex, setSelectedIndex] = React.useState(0);

    // Payloads beyond single-QR capacity can only be shown as animated frames;
    // rendering them as one QR throws in react-native-qrcode-svg
    const hideSingle = hideSingleFrame || data.length > SINGLE_FRAME_QR_MAX_LEN;

    const {
        frameIndex,
        bbqrParts,
        bcurPart,
        qrAnimationSpeed,
        setQRAnimationSpeed,
        isMultiFrame
    } = useQRAnimation({
        data,
        encoderType,
        fileType
    });

    const bcurIndex = hideSingle ? 0 : 1;
    const bbqrIndex = hideSingle ? 1 : 2;

    const isSingleFrameSelected = !hideSingle && selectedIndex === 0;
    const isBcurSelected = selectedIndex === bcurIndex;
    const isBbqrSelected = selectedIndex === bbqrIndex;

    const getDisplayValue = (): string => {
        if (isSingleFrameSelected) {
            return valuePrefix ? `${valuePrefix}${data}` : data;
        }
        if (isBcurSelected) {
            return bcurPart;
        }
        return bbqrParts[frameIndex] || '';
    };

    const getCopyValue = (): string => {
        if (copyValue) return copyValue;
        return valuePrefix ? `${valuePrefix}${data}` : data;
    };

    return (
        <>
            <QRFormatSelector
                selectedIndex={selectedIndex}
                onSelect={setSelectedIndex}
                hideSingleFrame={hideSingle}
            />
            <View style={{ margin: 10 }}>
                <CollapsedQR
                    value={getDisplayValue()}
                    copyValue={getCopyValue()}
                    showSpeed={
                        isBcurSelected || (isBbqrSelected && isMultiFrame)
                    }
                    truncateLongValue
                    expanded
                    qrAnimationSpeed={qrAnimationSpeed}
                    onQRAnimationSpeedChange={setQRAnimationSpeed}
                    onShareGiftLink={onShareGiftLink}
                />
            </View>
        </>
    );
};

export default AnimatedQRDisplay;
