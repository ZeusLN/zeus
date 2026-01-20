import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from './../components/Button';
import LightningIndicator from './../components/LightningIndicator';
import {
    SuccessMessage,
    ErrorMessage
} from './../components/SuccessErrorMessage';
import TextInput from './../components/TextInput';

import BackendUtils from './../utils/BackendUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import ChannelsStore from './../stores/ChannelsStore';
import FeeStore from './../stores/FeeStore';
import SettingsStore from './../stores/SettingsStore';

interface SetFeesFormProps {
    FeeStore?: FeeStore;
    ChannelsStore?: ChannelsStore;
    SettingsStore?: SettingsStore;
    baseFee?: string;
    feeRate?: string;
    baseFeeInbound?: string;
    feeRateInbound?: string;
    timeLockDelta?: string;
    channelPoint?: string;
    channelId?: string;
    minHtlc?: string;
    maxHtlc?: string;
    setFeesCompleted: () => void;
}

interface SetFeesFormState {
    feesSubmitted: boolean;
    newBaseFee: string;
    newFeeRate: string;
    newBaseFeeInbound: string;
    newFeeRateInbound: string;
    newTimeLockDelta: string;
    newMinHtlc: string;
    newMaxHtlc: string;
    feeRateUnit: '%' | 'ppm';
    feeRateInboundUnit: '%' | 'ppm';
}

@inject('FeeStore', 'ChannelsStore', 'SettingsStore')
@observer
export default class SetFeesForm extends React.Component<
    SetFeesFormProps,
    SetFeesFormState
> {
    constructor(props: any) {
        super(props);

        this.state = {
            feesSubmitted: false,
            newBaseFee: props.baseFee || '',
            newFeeRate: props.feeRate || '',
            newBaseFeeInbound: props.baseFeeInbound || '',
            newFeeRateInbound: props.feeRateInbound || '',
            newTimeLockDelta: props.timeLockDelta || '',
            newMinHtlc: props.minHtlc || '',
            newMaxHtlc: props.maxHtlc || '',
            feeRateUnit: '%',
            feeRateInboundUnit: '%'
        };
    }

    convertFeeRate = (
        value: string,
        fromUnit: '%' | 'ppm',
        toUnit: '%' | 'ppm'
    ): string => {
        if (fromUnit === toUnit || !value) return value;
        const sanitized = value.replace(',', '.');
        const num = parseFloat(sanitized);
        if (isNaN(num)) return '';
        return fromUnit === '%'
            ? (num * 10000).toString()
            : (num / 10000).toString();
    };

    prepareFeeRateForSubmission = (
        value: string,
        unit: '%' | 'ppm'
    ): string => {
        if (unit === '%') return value;
        const sanitized = value.replace(',', '.');
        const parsed = parseFloat(sanitized);
        return isNaN(parsed) ? '' : (parsed / 10000).toString();
    };

    render() {
        const {
            feesSubmitted,
            newBaseFee,
            newFeeRate,
            newBaseFeeInbound,
            newFeeRateInbound,
            newTimeLockDelta,
            newMinHtlc,
            newMaxHtlc,
            feeRateUnit,
            feeRateInboundUnit
        } = this.state;
        const {
            FeeStore,
            ChannelsStore,
            SettingsStore,
            baseFee,
            feeRate,
            baseFeeInbound,
            feeRateInbound,
            timeLockDelta,
            channelPoint,
            channelId,
            minHtlc,
            maxHtlc,
            setFeesCompleted
        } = this.props;
        const {
            setFees,
            loading,
            setFeesError,
            setFeesErrorMsg,
            setFeesSuccess
        } = FeeStore!;
        const { implementation } = SettingsStore!;

        return (
            <React.Fragment>
                {feesSubmitted && setFeesSuccess && (
                    <SuccessMessage
                        message={localeString('components.SetFeesForm.success')}
                    />
                )}
                {feesSubmitted && setFeesError && (
                    <ErrorMessage
                        message={
                            setFeesErrorMsg
                                ? setFeesErrorMsg
                                : localeString('components.SetFeesForm.error')
                        }
                    />
                )}
                <Text
                    style={{
                        ...styles.text,
                        color: themeColor('secondaryText')
                    }}
                >
                    {`${localeString(
                        'components.SetFeesForm.baseFee'
                    )} (${localeString('general.sats')})`}
                </Text>
                <TextInput
                    keyboardType="numeric"
                    placeholder={baseFee || '1'}
                    value={newBaseFee}
                    onChangeText={(text: string) =>
                        this.setState({
                            newBaseFee: text
                        })
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                <Text
                    style={{
                        ...styles.text,
                        color: themeColor('secondaryText')
                    }}
                >
                    {localeString('components.SetFeesForm.feeRate')}
                </Text>
                <TextInput
                    keyboardType="numeric"
                    placeholder={
                        feeRate ||
                        (implementation === 'cln-rest'
                            ? '1'
                            : feeRateUnit === 'ppm'
                              ? '10'
                              : '0.001')
                    }
                    value={newFeeRate}
                    onChangeText={(text: string) =>
                        this.setState({
                            newFeeRate: text
                        })
                    }
                    suffix={
                        implementation === 'cln-rest'
                            ? localeString(
                                  'components.SetFeesForm.ppmMilliMsat'
                              )
                            : feeRateUnit === '%'
                              ? localeString('general.percentage')
                              : localeString('components.SetFeesForm.ppm')
                    }
                    toggleUnits={
                        implementation !== 'cln-rest'
                            ? () => {
                                  const newUnit =
                                      feeRateUnit === '%' ? 'ppm' : '%';
                                  this.setState({
                                      feeRateUnit: newUnit,
                                      newFeeRate: this.convertFeeRate(
                                          newFeeRate,
                                          feeRateUnit,
                                          newUnit
                                      )
                                  });
                              }
                            : undefined
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {BackendUtils.supportInboundFees() && (
                    <>
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {`${localeString(
                                'views.Channel.inbound'
                            )} ${localeString(
                                'components.SetFeesForm.baseFee'
                            )} (${localeString('general.sats')})`}
                        </Text>
                        <TextInput
                            // @ts-ignore:next-line
                            keyboardType="decimal"
                            placeholder={baseFeeInbound || '1'}
                            value={newBaseFeeInbound}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newBaseFeeInbound: text
                                })
                            }
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {`${localeString(
                                'views.Channel.inbound'
                            )} ${localeString(
                                'components.SetFeesForm.feeRate'
                            )}`}
                        </Text>
                        <TextInput
                            // @ts-ignore:next-line
                            keyboardType="decimal"
                            placeholder={
                                feeRateInbound ||
                                (feeRateInboundUnit === 'ppm' ? '10' : '0.001')
                            }
                            value={newFeeRateInbound}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newFeeRateInbound: text
                                })
                            }
                            suffix={
                                feeRateInboundUnit === '%'
                                    ? localeString('general.percentage')
                                    : localeString('components.SetFeesForm.ppm')
                            }
                            toggleUnits={() => {
                                const newUnit =
                                    feeRateInboundUnit === '%' ? 'ppm' : '%';
                                this.setState({
                                    feeRateInboundUnit: newUnit,
                                    newFeeRateInbound: this.convertFeeRate(
                                        newFeeRateInbound,
                                        feeRateInboundUnit,
                                        newUnit
                                    )
                                });
                            }}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </>
                )}

                {BackendUtils.isLNDBased() && (
                    <>
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString(
                                'components.SetFeesForm.timeLockDelta'
                            )}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            placeholder={timeLockDelta || '144'}
                            value={newTimeLockDelta}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newTimeLockDelta: text
                                })
                            }
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('components.SetFeesForm.minHtlc')}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            placeholder={minHtlc || '1'}
                            value={newMinHtlc}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newMinHtlc: text
                                })
                            }
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('components.SetFeesForm.maxHtlc')}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            placeholder={maxHtlc || '250000'}
                            value={newMaxHtlc}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newMaxHtlc: text
                                })
                            }
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </>
                )}

                {loading && <LightningIndicator />}
                {!loading && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'components.SetFeesForm.submit'
                            )}
                            onPress={() => {
                                const feeRateToSubmit =
                                    implementation === 'cln-rest'
                                        ? newFeeRate
                                        : this.prepareFeeRateForSubmission(
                                              newFeeRate,
                                              feeRateUnit
                                          );

                                const feeRateInboundToSubmit =
                                    this.prepareFeeRateForSubmission(
                                        newFeeRateInbound,
                                        feeRateInboundUnit
                                    );

                                setFees(
                                    newBaseFee,
                                    feeRateToSubmit,
                                    newBaseFeeInbound,
                                    feeRateInboundToSubmit,
                                    Number(newTimeLockDelta),
                                    channelPoint,
                                    channelId,
                                    newMinHtlc,
                                    newMaxHtlc
                                )
                                    .then(() => {
                                        if (
                                            channelId &&
                                            BackendUtils.isLNDBased() &&
                                            !setFeesError
                                        ) {
                                            ChannelsStore!.loadChannelInfo(
                                                channelId
                                            );
                                        }
                                    })
                                    .finally(() => setFeesCompleted());
                                this.setState({ feesSubmitted: true });
                            }}
                            tertiary
                        />
                    </View>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
