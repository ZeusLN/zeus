import * as React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
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
    FeeStore: FeeStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    baseFee?: string;
    feeRate?: string;
    timeLockDelta?: string;
    channelPoint?: string;
    channelId?: string;
    minHtlc?: string;
    maxHtlc?: string;
}

interface SetFeesFormState {
    feesSubmitted: boolean;
    newBaseFee: string;
    newFeeRate: string;
    newTimeLockDelta: string;
    newMinHtlc: string;
    newMaxHtlc: string;
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
            newTimeLockDelta: props.timeLockDelta || '',
            newMinHtlc: props.minHtlc || '',
            newMaxHtlc: props.maxHtlc || ''
        };
    }

    render() {
        const {
            feesSubmitted,
            newBaseFee,
            newFeeRate,
            newTimeLockDelta,
            newMinHtlc,
            newMaxHtlc
        } = this.state;
        const {
            ChannelsStore,
            baseFee,
            feeRate,
            timeLockDelta,
            channelPoint,
            channelId,
            minHTLC,
            maxHTLC
        } = this.props;
        const {
            setFees,
            loading,
            setFeesError,
            setFeesErrorMsg,
            setFeesSuccess
        } = this.props.FeeStore;
        const { implementation } = this.props.SettingsStore;

        return (
            <React.Fragment>
                <ScrollView
                    style={{ paddingTop: 15 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {loading && <LightningIndicator />}
                    {feesSubmitted && setFeesSuccess && (
                        <SuccessMessage
                            message={localeString(
                                'components.SetFeesForm.success'
                            )}
                        />
                    )}
                    {feesSubmitted && setFeesError && (
                        <ErrorMessage
                            message={
                                setFeesErrorMsg
                                    ? setFeesErrorMsg
                                    : localeString(
                                          'components.SetFeesForm.error'
                                      )
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
                        {`${localeString('components.SetFeesForm.feeRate')} (${
                            implementation === 'c-lightning-REST'
                                ? localeString(
                                      'components.SetFeesForm.ppmMilliMsat'
                                  )
                                : localeString('general.percentage')
                        })`}
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        placeholder={
                            feeRate || implementation === 'c-lightning-REST'
                                ? '1'
                                : '0.001'
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
                                placeholder={minHTLC || '1'}
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
                                placeholder={maxHTLC || '250000'}
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

                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'components.SetFeesForm.submit'
                            )}
                            onPress={() => {
                                setFees(
                                    newBaseFee,
                                    newFeeRate,
                                    Number(newTimeLockDelta),
                                    channelPoint,
                                    channelId,
                                    newMinHtlc,
                                    newMaxHtlc
                                ).then(() => {
                                    if (
                                        channelId &&
                                        BackendUtils.isLNDBased() &&
                                        !setFeesError
                                    ) {
                                        ChannelsStore.getChannelInfo(channelId);
                                    }
                                });
                                this.setState({ feesSubmitted: true });
                            }}
                            tertiary
                        />
                    </View>
                </ScrollView>
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
