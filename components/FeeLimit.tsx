import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import BigNumber from 'bignumber.js';

import Amount from './Amount';
import TextInput from './TextInput';

import { Row } from './layout/Row';

import SettingsStore from '../stores/SettingsStore';
import InvoicesStore from '../stores/InvoicesStore';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface FeeLimitProps {
    onFeeLimitSatChange: (satAmount: string) => void;
    onMaxFeePercentChange?: (maxFeePercent: string) => void;
    satAmount?: string | number;
    SettingsStore: SettingsStore;
    InvoicesStore?: InvoicesStore;
    feeOption?: string;
    displayFeeRecommendation?: boolean;
    // render but do not display so our calculations
    // are always done on PaymentRequest view
    hide?: boolean;
}

interface FeeLimitState {
    feeLimitSat: string;
    maxFeePercent: string;
    feeOption: string;
    percentAmount: string;
    satAmount: string;
}

@inject('SettingsStore', 'InvoicesStore')
@observer
export default class FeeLimit extends React.Component<
    FeeLimitProps,
    FeeLimitState
> {
    constructor(props: any) {
        super(props);

        this.state = {
            feeOption: 'fixed',
            feeLimitSat: '100',
            maxFeePercent: '5.0',
            percentAmount: '0',
            satAmount: '0'
        };
    }

    async UNSAFE_componentWillMount(): Promise<void> {
        const { SettingsStore, feeOption, satAmount, onFeeLimitSatChange } =
            this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        const feeLimitSat = settings?.payments?.defaultFeeFixed || '100';

        this.setState(
            {
                satAmount: satAmount !== '' ? JSON.stringify(satAmount) : '0',
                feeLimitSat,
                maxFeePercent: settings?.payments?.defaultFeePercentage || '5.0'
            },
            () => {
                const percentAmount = this.calculatePercentAmount(satAmount);

                this.setState({
                    percentAmount
                });

                if (feeOption) {
                    this.setState(
                        {
                            feeOption
                        },
                        () => {
                            onFeeLimitSatChange(
                                BackendUtils.isLNDBased() &&
                                    this.state.feeOption === 'percent'
                                    ? percentAmount
                                    : feeLimitSat
                            );
                        }
                    );
                } else {
                    onFeeLimitSatChange(
                        BackendUtils.isLNDBased() &&
                            this.state.feeOption === 'percent'
                            ? percentAmount
                            : feeLimitSat
                    );
                }
            }
        );
    }

    UNSAFE_componentWillReceiveProps(newProps: any) {
        const { satAmount, onFeeLimitSatChange } = newProps;
        const { feeLimitSat, feeOption } = this.state;

        const percentAmount = this.calculatePercentAmount(satAmount);
        const percentUpdated = percentAmount !== this.state.percentAmount;

        const satAmountUpdated = satAmount !== this.state.satAmount;

        if (percentUpdated) {
            this.setState({
                percentAmount
            });
        }

        if (satAmountUpdated) {
            this.setState({
                satAmount
            });
        }

        if (percentUpdated || satAmountUpdated) {
            onFeeLimitSatChange(
                BackendUtils.isLNDBased() && feeOption === 'percent'
                    ? percentAmount
                    : feeLimitSat
            );
        }
    }

    calculatePercentAmount = (satAmount?: string | number) => {
        const { maxFeePercent } = this.state;
        // handle fee percents that use commas
        const maxFeePercentFormatted = maxFeePercent.replace(/,/g, '.');

        const percentAmount = satAmount
            ? new BigNumber(maxFeePercentFormatted)
                  .div(100)
                  .times(satAmount)
                  .toNumber()
                  .toFixed()
                  .toString()
            : '0';

        return percentAmount === 'NaN' ? '0' : percentAmount;
    };

    feeRecommendation = () => {
        const { feeLimitSat } = this.state;
        const { InvoicesStore } = this.props;
        const { feeEstimate } = InvoicesStore!;

        if (
            feeEstimate &&
            feeLimitSat &&
            Number(feeEstimate) > Number(feeLimitSat)
        ) {
            return (
                <Text
                    style={{
                        color: themeColor('error')
                    }}
                >
                    {localeString(
                        'views.PaymentRequest.feeEstimateExceedsLimit'
                    )}
                </Text>
            );
        }
        return null;
    };

    render() {
        const {
            SettingsStore,
            onFeeLimitSatChange,
            onMaxFeePercentChange,
            displayFeeRecommendation,
            satAmount,
            hide
        } = this.props;
        const { feeOption, feeLimitSat, maxFeePercent, percentAmount } =
            this.state;
        const { implementation } = SettingsStore;

        const isLnd: boolean = BackendUtils.isLNDBased();
        const isCLightning: boolean = implementation === 'c-lightning-REST';

        if (hide) return;

        return (
            <React.Fragment>
                {isLnd && (
                    <>
                        <Row justify="space-between">
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.PaymentRequest.feeLimit')}
                            </Text>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text'),
                                    opacity: feeOption == 'percent' ? 1 : 0.25
                                }}
                            >
                                <Amount sats={percentAmount} />
                            </Text>
                        </Row>
                        {displayFeeRecommendation && this.feeRecommendation()}
                        <View
                            style={{
                                flexDirection: 'row',
                                width: '95%'
                            }}
                        >
                            <TextInput
                                style={{
                                    width: '50%',
                                    opacity: feeOption == 'fixed' ? 1 : 0.25
                                }}
                                keyboardType="numeric"
                                value={feeLimitSat}
                                onChangeText={(text: string) => {
                                    this.setState({
                                        feeLimitSat: text
                                    });
                                    onFeeLimitSatChange(text);
                                }}
                                onPressIn={() => {
                                    this.setState({
                                        feeOption: 'fixed'
                                    });
                                    onFeeLimitSatChange(feeLimitSat);
                                }}
                            />
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text'),
                                    top: 28,
                                    right: 30,
                                    opacity: feeOption == 'fixed' ? 1 : 0.25
                                }}
                            >
                                {localeString('general.sats')}
                            </Text>
                            <TextInput
                                style={{
                                    width: '50%',
                                    opacity: feeOption == 'percent' ? 1 : 0.25
                                }}
                                keyboardType="numeric"
                                value={maxFeePercent}
                                onChangeText={(text: string) => {
                                    this.setState(
                                        {
                                            maxFeePercent: text
                                        },
                                        () => {
                                            const percentAmount =
                                                this.calculatePercentAmount(
                                                    satAmount
                                                );

                                            this.setState({
                                                percentAmount
                                            });
                                            onFeeLimitSatChange(percentAmount);

                                            if (onMaxFeePercentChange)
                                                onMaxFeePercentChange(text);
                                        }
                                    );
                                }}
                                onPressIn={() => {
                                    this.setState({
                                        feeOption: 'percent'
                                    });
                                    onFeeLimitSatChange(percentAmount);
                                }}
                            />
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text'),
                                    top: 28,
                                    right: 18,
                                    opacity: feeOption == 'percent' ? 1 : 0.25
                                }}
                            >
                                {'%'}
                            </Text>
                        </View>
                    </>
                )}

                {isCLightning && (
                    <React.Fragment>
                        <Row justify="space-between">
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString('views.PaymentRequest.feeLimit')}
                            </Text>
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text')
                                }}
                            >
                                <Amount sats={percentAmount} />
                            </Text>
                        </Row>
                        <View
                            style={{
                                flexDirection: 'row'
                            }}
                        >
                            <TextInput
                                keyboardType="numeric"
                                value={maxFeePercent}
                                onChangeText={(text: string) => {
                                    this.setState(
                                        {
                                            maxFeePercent: text
                                        },
                                        () => {
                                            const percentAmount =
                                                this.calculatePercentAmount(
                                                    satAmount
                                                );

                                            this.setState({
                                                percentAmount
                                            });
                                            onFeeLimitSatChange(percentAmount);

                                            if (onMaxFeePercentChange)
                                                onMaxFeePercentChange(text);
                                        }
                                    );
                                }}
                                onPressIn={() => {
                                    this.setState({
                                        feeOption: 'percent'
                                    });
                                    onFeeLimitSatChange(percentAmount);
                                }}
                            />
                            <Text
                                style={{
                                    ...styles.label,
                                    color: themeColor('text'),
                                    top: 28,
                                    right: 24
                                }}
                            >
                                {'%'}
                            </Text>
                        </View>
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    label: {
        fontFamily: 'PPNeueMontreal-Book',
        paddingTop: 5
    }
});

export { FeeLimit };
