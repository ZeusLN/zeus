import * as React from 'react';
import { View } from 'react-native';

import CollapsedQR from './CollapsedQR';
import QRFormatSelector from './QRFormatSelector';

import {
    useQRAnimation,
    QREncoderType,
    BBQrFileType
} from '../hooks/useQRAnimation';

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

    const isSingleFrameSelected = !hideSingleFrame && selectedIndex === 0;
    const isBcurSelected =
        (!hideSingleFrame && selectedIndex === 1) ||
        (hideSingleFrame && selectedIndex === 0);
    const isBbqrSelected =
        (!hideSingleFrame && selectedIndex === 2) ||
        (hideSingleFrame && selectedIndex === 1);

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
                hideSingleFrame={hideSingleFrame}
            />
            <View style={{ margin: 10 }}>
                <CollapsedQR
                    value={getDisplayValue()}
                    copyValue={getCopyValue()}
                    iconOnly
                    showShare={
                        isSingleFrameSelected ||
                        (isBbqrSelected && !isMultiFrame)
                    }
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
