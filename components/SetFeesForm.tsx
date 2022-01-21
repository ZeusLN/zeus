import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import Button from './../components/Button';
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
}

interface SetFeesFormState {
    showNewFeesForm: boolean;
    feesSubmitted: boolean;
    newBaseFee: string;
    newFeeRate: string;
    newTimeLockDelta: string;
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
            showNewFeesForm: false,
            feesSubmitted: false,
            newBaseFee: props.baseFee || '1',
            newFeeRate: props.feeRate || '0.001',
            newTimeLockDelta: props.timeLockDelta || '144'
        };
    }

    render() {
        const {
            showNewFeesForm,
            feesSubmitted,
            newBaseFee,
            newFeeRate,
            newTimeLockDelta
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
            expanded
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
                            placeholderTextColor="darkgray"
                            value={newBaseFee}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newBaseFee: text
                                })
                            }
                            numberOfLines={1}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={{ fontSize: 20, color: themeColor('text') }}
                        />

                        <Text style={{ color: themeColor('text') }}>
                            {`${localeString(
                                'components.SetFeesForm.feeRate'
                            )} (${localeString('general.percentage')})`}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            placeholder={feeRate || '1'}
                            placeholderTextColor="darkgray"
                            value={newFeeRate}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newFeeRate: text
                                })
                            }
                            numberOfLines={1}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={{ fontSize: 20, color: themeColor('text') }}
                        />

                        <Text style={{ color: themeColor('text') }}>
                            {localeString(
                                'components.SetFeesForm.timeLockDelta'
                            )}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            placeholder={timeLockDelta || '144'}
                            placeholderTextColor="darkgray"
                            value={newTimeLockDelta}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newTimeLockDelta: text
                                })
                            }
                            numberOfLines={1}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={{ fontSize: 20, color: themeColor('text') }}
                        />

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
                                        channelId
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
