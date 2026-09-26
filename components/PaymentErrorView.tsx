import * as React from 'react';
import { Dimensions, Text, View } from 'react-native';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';
import PaymentReturnedIcon from '../assets/images/SVG/PaymentReturnedIcon.svg';

interface PaymentErrorViewProps {
    errorMessage?: string | null;
    // the recipient rejected or canceled the payment (e.g. a canceled hold
    // invoice); not necessarily an error from the payer's point of view
    rejectedByRecipient?: boolean;
}

export default function PaymentErrorView({
    errorMessage,
    rejectedByRecipient
}: PaymentErrorViewProps) {
    const windowSize = Dimensions.get('window');
    const Icon = rejectedByRecipient ? PaymentReturnedIcon : ErrorIcon;

    return (
        <View style={{ alignItems: 'center' }}>
            <Icon
                width={windowSize.height * 0.13}
                height={windowSize.height * 0.13}
            />
            <Text
                style={{
                    color: rejectedByRecipient
                        ? themeColor('text')
                        : themeColor('warning'),
                    fontFamily: 'PPNeueMontreal-Book',
                    fontSize: 32,
                    marginTop: windowSize.height * 0.07,
                    textAlign: 'center'
                }}
            >
                {rejectedByRecipient
                    ? localeString('views.SendingLightning.paymentNotCompleted')
                    : localeString('general.error')}
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
