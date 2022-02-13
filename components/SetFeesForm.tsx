import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from './../components/Button';
import LoadingIndicator from './../components/LoadingIndicator';
import {
    SuccessMessage,
    ErrorMessage
} from './../components/SuccessErrorMessage';
import TextInput from './../components/TextInput';

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
    expanded?: boolean;
    minHtlc?: string;
    maxHtlc?: string;
}

interface SetFeesFormState {
    showNewFeesForm: boolean;
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

        const { SettingsStore } = props;
        const { implementation } = SettingsStore;

        this.state = {
            showNewFeesForm: false,
            feesSubmitted: false,
            newBaseFee: props.baseFee || '1',
            newFeeRate: props.feeRate
                ? props.feeRate
                : implementation === 'c-lightning-REST'
                ? '1'
                : '0.001',
            newTimeLockDelta: props.timeLockDelta || '144',
            newMinHtlc: props.minHtlc,
            newMaxHtlc: props.maxHtlc
        };
    }

    render() {
        const {
            showNewFeesForm,
            feesSubmitted,
            newBaseFee,
            newFeeRate,
            newTimeLockDelta,
            newMinHtlc,
            newMaxHtlc
        } = this.state;
        const {
            FeeStore,
            ChannelsStore,
            SettingsStore,
            baseFee,
            feeRate,
            timeLockDelta,
            channelPoint,
            channelId,
            expanded,
            minHTLC,
            maxHTLC
        } = this.props;
        const {
            setFees,
            loading,
            setFeesError,
            setFeesErrorMsg,
            setFeesSuccess
        } = FeeStore;
        const { implementation } = SettingsStore;

        return (
            <React.Fragment>
                {!expanded && (
                    <View style={styles.button}>
                        <Button
                            title={
                                showNewFeesForm
                                    ? localeString(
                                          'components.SetFeesForm.hide'
                                      )
                                    : localeString(
                                          'components.SetFeesForm.setNew'
                                      )
                            }
                            onPress={() =>
                                this.setState({
                                    showNewFeesForm: !showNewFeesForm
                                })
                            }
                        />
                    </View>
                )}

                {(expanded || showNewFeesForm) && (
                    <View style={{ paddingTop: 15 }}>
                        {loading && <LoadingIndicator />}
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
                            {`${localeString(
                                'components.SetFeesForm.feeRate'
                            )} (${
                                implementation === 'c-lightning-REST'
                                    ? localeString(
                                          'components.SetFeesForm.ppmMilliMsat'
                                      )
                                    : localeString('general.percentage')
                            })`}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            placeholder={feeRate || '1'}
                            value={newFeeRate}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newFeeRate: text
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

                        {implementation === 'lnd' && (
                            <>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'components.SetFeesForm.minHtlc'
                                    )}
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
                                    {localeString(
                                        'components.SetFeesForm.maxHtlc'
                                    )}
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
                                            implementation === 'lnd' &&
                                            !setFeesError
                                        ) {
                                            ChannelsStore.getChannelInfo(
                                                channelId
                                            );
                                        }
                                    });
                                    this.setState({ feesSubmitted: true });
                                }}
                                tertiary
                            />
                        </View>
                    </View>
                )}
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
