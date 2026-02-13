import * as React from 'react';
import { Text, View } from 'react-native';
import { observer } from 'mobx-react';

import Amount from './Amount';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import BackendUtils from '../utils/BackendUtils';

/** Typical vbytes for a 1-input, 2-output P2WPKH tx (payment + change). */
const ESTIMATED_ONCHAIN_VBYTES = 140;

interface FeeEstimateProps {
    satAmount: string;
    lightning?: string;
    lnurlParams?: any;
    value?: string;
    lightningEstimateFee?: number;
    ecashEstimateFee?: number;
    feeRate?: string;
}

const FeeEstimate: React.FC<FeeEstimateProps> = observer(
    ({
        satAmount,
        lightning,
        lnurlParams,
        value,
        lightningEstimateFee,
        ecashEstimateFee,
        feeRate
    }) => {
        const calculateOnchainFee = (feeRateSatPerVbyte: number): number =>
            Math.ceil(feeRateSatPerVbyte * ESTIMATED_ONCHAIN_VBYTES);
        if (!satAmount) return null;
        const parsed = feeRate != null ? Number(feeRate) : NaN;
        const onchainFeeRate =
            !isNaN(parsed) && !isNaN(Number(feeRate)) ? Number(feeRate) : 0;
        const onchainFee = value ? calculateOnchainFee(onchainFeeRate) : 0;

        return (
            <View style={{ paddingTop: 15 }}>
                <View
                    style={{
                        flexDirection: 'row',
                        paddingHorizontal: 10,
                        paddingBottom: 8
                    }}
                >
                    <View style={{ flex: 1 }} />
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 12,
                                textTransform: 'uppercase'
                            }}
                        >
                            {localeString('views.PaymentRequest.feeEstimate')}
                        </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 12,
                                textTransform: 'uppercase'
                            }}
                        >
                            {localeString(
                                'components.NWCPendingPayInvoiceModal.totalAmount'
                            )}
                        </Text>
                    </View>
                </View>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        paddingHorizontal: 10
                    }}
                >
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 14
                            }}
                        >
                            {localeString('general.lightning')}
                        </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        {lightningEstimateFee !== undefined ? (
                            <Amount
                                sats={lightningEstimateFee}
                                sensitive={false}
                                colorOverride={themeColor('bitcoin')}
                            />
                        ) : (
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 12
                                }}
                            >
                                -
                            </Text>
                        )}
                    </View>
                    <View style={{ flex: 1, alignItems: 'center' }}>
                        {lightningEstimateFee !== undefined ? (
                            <Amount
                                sats={
                                    Number(satAmount) +
                                    (Number(lightningEstimateFee) || 0)
                                }
                                sensitive={false}
                            />
                        ) : (
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 12
                                }}
                            >
                                -
                            </Text>
                        )}
                    </View>
                </View>
                {BackendUtils.supportsCashuWallet() &&
                    (lightning || lnurlParams) && (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: 10
                            }}
                        >
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 14
                                    }}
                                >
                                    {localeString('general.ecash')}
                                </Text>
                            </View>
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: 'center'
                                }}
                            >
                                {ecashEstimateFee !== undefined ? (
                                    <Amount
                                        sats={ecashEstimateFee}
                                        sensitive={false}
                                        colorOverride={themeColor('bitcoin')}
                                    />
                                ) : (
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 12
                                        }}
                                    >
                                        -
                                    </Text>
                                )}
                            </View>
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: 'center'
                                }}
                            >
                                {ecashEstimateFee !== undefined ? (
                                    <Amount
                                        sats={
                                            Number(satAmount) +
                                            (Number(ecashEstimateFee) || 0)
                                        }
                                        sensitive={false}
                                    />
                                ) : (
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 12
                                        }}
                                    >
                                        -
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}
                {value && BackendUtils.supportsOnchainReceiving() && (
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 8,
                            paddingHorizontal: 10
                        }}
                    >
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 14
                                }}
                            >
                                {localeString('general.onchain')}
                            </Text>
                        </View>

                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Amount
                                sats={onchainFee}
                                sensitive={false}
                                colorOverride={themeColor('bitcoin')}
                            />
                        </View>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Amount
                                sats={Number(satAmount) + onchainFee}
                                sensitive={false}
                            />
                        </View>
                    </View>
                )}
            </View>
        );
    }
);

export default FeeEstimate;
