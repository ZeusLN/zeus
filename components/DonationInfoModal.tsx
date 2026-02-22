import * as React from 'react';
import { Text, View } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from './Button';
import CopyBox from './CopyBox';
import KeyValue from './KeyValue';
import Amount from './Amount';
import ModalBox from './ModalBox';
import { Row } from './layout/Row';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface DonationInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    donationHandled: boolean;
    amountDonated: number | null;
    donationPreimage: string;
    // Optional LND-specific props
    donationFee?: string;
    donationFeePercentage?: string;
    donationEnhancedPath?: any;
    donationPathExists?: boolean;
    navigation?: StackNavigationProp<any, any>;
}

export default function DonationInfoModal({
    isOpen,
    onClose,
    donationHandled,
    amountDonated,
    donationPreimage,
    donationFee,
    donationFeePercentage,
    donationEnhancedPath,
    donationPathExists,
    navigation
}: DonationInfoModalProps) {
    return (
        <ModalBox
            isOpen={isOpen}
            style={{
                backgroundColor: 'transparent'
            }}
            onClosed={onClose}
            position="center"
        >
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                <View
                    style={{
                        backgroundColor: themeColor('secondary'),
                        borderRadius: 24,
                        padding: 20,
                        alignItems: 'center',
                        width: '90%'
                    }}
                >
                    {donationHandled ? (
                        <>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('text'),
                                    marginBottom: 12,
                                    fontSize: 18,
                                    textAlign: 'center'
                                }}
                            >
                                {localeString(
                                    'views.PaymentRequest.thankYouForDonation'
                                )}
                            </Text>
                            <View
                                style={{
                                    width: '100%',
                                    marginBottom: -10
                                }}
                            >
                                <KeyValue
                                    keyValue={localeString(
                                        'views.PaymentRequest.amountDonated'
                                    )}
                                    value={
                                        <Amount
                                            sats={amountDonated?.toString()}
                                            sensitive
                                            toggleable
                                        />
                                    }
                                />
                            </View>
                            {donationFee && donationFeePercentage && (
                                <View
                                    style={{
                                        width: '100%'
                                    }}
                                >
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Payment.fee'
                                        )}
                                        value={
                                            <Row>
                                                <Amount
                                                    sats={donationFee}
                                                    debit
                                                    sensitive
                                                    toggleable
                                                />
                                                {donationFeePercentage && (
                                                    <Text
                                                        style={{
                                                            fontFamily:
                                                                'PPNeueMontreal-Book',
                                                            color: themeColor(
                                                                'text'
                                                            )
                                                        }}
                                                    >
                                                        {` (${donationFeePercentage})`}
                                                    </Text>
                                                )}
                                            </Row>
                                        }
                                    />
                                </View>
                            )}

                            {donationPreimage && (
                                <View
                                    style={{
                                        width: '100%',
                                        marginTop: donationFee ? 12 : 16
                                    }}
                                >
                                    <CopyBox
                                        heading={localeString(
                                            'views.Payment.paymentPreimage'
                                        )}
                                        headingCopied={`${localeString(
                                            'views.Payment.paymentPreimage'
                                        )} ${localeString(
                                            'components.ExternalLinkModal.copied'
                                        )}`}
                                        theme="dark"
                                        URL={donationPreimage}
                                    />
                                </View>
                            )}
                            {donationPathExists && (
                                <Button
                                    title={`${localeString(
                                        'views.Payment.title'
                                    )} ${
                                        donationEnhancedPath?.length > 1
                                            ? `${localeString(
                                                  'views.Payment.paths'
                                              )} (${
                                                  donationEnhancedPath.length
                                              })`
                                            : localeString('views.Payment.path')
                                    } `}
                                    onPress={() => {
                                        onClose();
                                        navigation?.navigate('PaymentPaths', {
                                            enhancedPath: donationEnhancedPath
                                        });
                                    }}
                                    buttonStyle={{
                                        height: 40,
                                        width: '100%'
                                    }}
                                    containerStyle={{ marginTop: 30 }}
                                />
                            )}
                        </>
                    ) : (
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                color: themeColor('text'),
                                fontSize: 18,
                                marginBottom: 20,
                                textAlign: 'center'
                            }}
                        >
                            {localeString(
                                'views.SendingLightning.donationFailed'
                            )}
                        </Text>
                    )}
                    <Button
                        title={localeString('general.close')}
                        onPress={onClose}
                        containerStyle={{
                            marginTop: donationPathExists ? 14 : 18
                        }}
                        tertiary
                    />
                </View>
            </View>
        </ModalBox>
    );
}
