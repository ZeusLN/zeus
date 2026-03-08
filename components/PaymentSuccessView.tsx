import * as React from 'react';
import { Dimensions, Text, View } from 'react-native';

import PaidIndicator from './PaidIndicator';
import SuccessAnimation from './SuccessAnimation';
import Amount from './Amount';
import { Row } from './layout/Row';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface PaymentSuccessViewProps {
    paymentAmount?: string | number | null;
    feeAmount?: string | number | null;
    paymentDuration?: number | null;
}

export default function PaymentSuccessView({
    paymentAmount,
    feeAmount,
    paymentDuration
}: PaymentSuccessViewProps) {
    const windowSize = Dimensions.get('window');
    const amountFontSize = windowSize.width * windowSize.scale * 0.013;

    return (
        <>
            <PaidIndicator />
            <View style={{ alignItems: 'center' }}>
                <SuccessAnimation />
                <Text
                    style={{
                        color: themeColor('text'),
                        paddingTop: windowSize.height * 0.03,
                        fontFamily: 'PPNeueMontreal-Book',
                        fontSize: windowSize.width * windowSize.scale * 0.017
                    }}
                >
                    {localeString('views.SendingLightning.success')}
                </Text>
                {paymentAmount != null && (
                    <Row
                        style={{
                            marginTop: 10,
                            alignItems: 'baseline'
                        }}
                    >
                        <Amount
                            sats={paymentAmount}
                            sensitive
                            toggleable
                            fontSize={amountFontSize}
                        />
                        {feeAmount != null && (
                            <Row
                                style={{
                                    alignItems: 'baseline'
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: amountFontSize
                                    }}
                                >
                                    {' (+'}
                                </Text>
                                <Amount
                                    sats={feeAmount}
                                    sensitive
                                    toggleable
                                    fontSize={amountFontSize}
                                />
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: amountFontSize
                                    }}
                                >
                                    {` ${localeString(
                                        'views.Payment.fee'
                                    ).toLowerCase()})`}
                                </Text>
                            </Row>
                        )}
                    </Row>
                )}
                {paymentDuration != null && (
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            marginTop: 10,
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {localeString('views.SendingLightning.paymentSettled', {
                            seconds: paymentDuration.toFixed(2)
                        })}
                    </Text>
                )}
            </View>
        </>
    );
}
