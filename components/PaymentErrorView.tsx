import * as React from 'react';
import { Dimensions, Text, View } from 'react-native';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';

interface PaymentErrorViewProps {
    errorMessage?: string | null;
}

export default function PaymentErrorView({
    errorMessage
}: PaymentErrorViewProps) {
    const windowSize = Dimensions.get('window');

    return (
        <View style={{ alignItems: 'center' }}>
            <ErrorIcon
                width={windowSize.height * 0.13}
                height={windowSize.height * 0.13}
            />
            <Text
                style={{
                    color: themeColor('warning'),
                    fontFamily: 'PPNeueMontreal-Book',
                    fontSize: 32,
                    marginTop: windowSize.height * 0.07
                }}
            >
                {localeString('general.error')}
            </Text>
            {errorMessage && (
                <Text
                    style={{
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book',
                        fontSize: windowSize.width * windowSize.scale * 0.014,
                        textAlign: 'center',
                        marginTop: windowSize.height * 0.025,
                        padding: 5
                    }}
                >
                    {errorMessage}
                </Text>
            )}
        </View>
    );
}
