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
import ToggleButton from './../components/ToggleButton';

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
    isFeeRatePPM: boolean;
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
            isFeeRatePPM: false
        };
    }

    toggleFeeRateMode = (key: string) => {
        const isFeeRatePPM = key === 'ppm';
        if (this.state.isFeeRatePPM === isFeeRatePPM) return;

        let { newFeeRate, newFeeRateInbound } = this.state;

        if (isFeeRatePPM) {
            if (newFeeRate !== '') {
                newFeeRate = (Number(newFeeRate) * 10000).toString();
            }
            if (newFeeRateInbound !== '') {
                newFeeRateInbound = (Number(newFeeRateInbound) * 10000).toString();
            }
        } else {
            if (newFeeRate !== '') {
                newFeeRate = (Number(newFeeRate) / 10000).toString();
            }
            if (newFeeRateInbound !== '') {
                newFeeRateInbound = (Number(newFeeRateInbound) / 10000).toString();
            }
        }

        this.setState({
            isFeeRatePPM,
            newFeeRate: isNaN(Number(newFeeRate)) ? '' : newFeeRate,
            newFeeRateInbound: isNaN(Number(newFeeRateInbound)) ? '' : newFeeRateInbound
        });
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
            isFeeRatePPM
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

                <View style={{ marginBottom: 15, marginTop: 5, zIndex: 3 }}>
                    <ToggleButton
                        options={[
                            { key: 'percent', label: '%' },
                            { key: 'ppm', label: 'ppm' }
                        ]}
                        value={isFeeRatePPM ? 'ppm' : 'percent'}
                        onToggle={this.toggleFeeRateMode}
                    />
                </View>

                <Text
                    style={{
                        ...styles.text,
                        color: themeColor('secondaryText')
                    }}
                >
                    {`${localeString('components.SetFeesForm.feeRate')} (${
                        isFeeRatePPM
                            ? 'ppm'
                            : localeString('general.percentage')
                    })`}
                </Text>
                <TextInput
                    keyboardType="numeric"
                    placeholder={
                        feeRate
                            ? (isFeeRatePPM ? (Number(feeRate) * 10000).toString() : feeRate)
                            : (isFeeRatePPM ? '10' : (implementation === 'cln-rest' ? '1' : '0.001'))
                    }
                    value={newFeeRate}
                    onChangeText={(text: string) =>
                        this.setState({
                            newFeeRate: text
                        })
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
                            )} (${
                                isFeeRatePPM
                                    ? 'ppm'
                                    : localeString('general.percentage')
                            })`}
                        </Text>
                        <TextInput
                            // @ts-ignore:next-line
                            keyboardType="decimal"
                            placeholder={
                                feeRateInbound
                                    ? (isFeeRatePPM ? (Number(feeRateInbound) * 10000).toString() : feeRateInbound)
                                    : (isFeeRatePPM ? '10000' : '1')
                            }
                            value={newFeeRateInbound}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newFeeRateInbound: text
                                })
                            }
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
                                const finalFeeRate = isFeeRatePPM && newFeeRate !== '' 
                                    ? (Number(newFeeRate) / 10000).toString() 
                                    : newFeeRate;
                                const finalFeeRateInbound = isFeeRatePPM && newFeeRateInbound !== '' 
                                    ? (Number(newFeeRateInbound) / 10000).toString() 
                                    : newFeeRateInbound;

                                setFees(
                                    newBaseFee,
                                    finalFeeRate,
                                    newBaseFeeInbound,
                                    finalFeeRateInbound,
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
