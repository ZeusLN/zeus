import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import Button from './../components/Button';
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
            newFeeRate:
                props.feeRate || implementation === 'c-lightning-REST'
                    ? '1'
                    : '0.001',
            newTimeLockDelta: props.timeLockDelta || '144',
            newMinHtlc: props.minHtlc || '1',
            newMaxHtlc: props.maxHtlc || '250000'
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
                    <React.Fragment>
                        {loading && (
                            <Text style={{ color: themeColor('text') }}>
                                {localeString('components.SetFeesForm.setting')}
                            </Text>
                        )}
                        {feesSubmitted && setFeesSuccess && (
                            <Text
                                style={{
                                    color: 'green'
                                }}
                            >
                                {localeString('components.SetFeesForm.success')}
                            </Text>
                        )}
                        {feesSubmitted && setFeesError && (
                            <Text
                                style={{
                                    color: 'red'
                                }}
                            >
                                {setFeesErrorMsg
                                    ? setFeesErrorMsg
                                    : localeString(
                                          'components.SetFeesForm.error'
                                      )}
                            </Text>
                        )}

                        <Text style={{ color: themeColor('text') }}>
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

                        <Text style={{ color: themeColor('text') }}>
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

                        <Text style={{ color: themeColor('text') }}>
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
                                <Text style={{ color: themeColor('text') }}>
                                    {localeString(
                                        'components.SetFeesForm.minHtlc'
                                    )}
                                </Text>
                                <TextInput
                                    keyboardType="numeric"
                                    placeholder={minHTLC}
                                    value={newMinHtlc}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            newMinHtlc: text
                                        })
                                    }
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />

                                <Text style={{ color: themeColor('text') }}>
                                    {localeString(
                                        'components.SetFeesForm.maxHtlc'
                                    )}
                                </Text>
                                <TextInput
                                    keyboardType="numeric"
                                    placeholder={maxHTLC}
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
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
