import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from 'react-native-elements';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import { inject, observer } from 'mobx-react';

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
    newFeeRatePPM: string;
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
            newFeeRatePPM: props.feeRate || '1',
            newTimeLockDelta: props.timeLockDelta || '144'
        };
    }

    render() {
        const {
            showNewFeesForm,
            feesSubmitted,
            newBaseFee,
            newFeeRatePPM,
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
                            buttonStyle={{
                                backgroundColor: showNewFeesForm
                                    ? 'black'
                                    : 'green',
                                borderRadius: 30
                            }}
                        />
                    </View>
                )}

                {(expanded || showNewFeesForm) && (
                    <React.Fragment>
                        {loading && (
                            <Text style={styles.text}>
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

                        <Text style={styles.text}>
                            {localeString('components.SetFeesForm.baseFee')}
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
                            style={styles.textInput}
                        />

                        <Text style={styles.text}>
                            {localeString('components.SetFeesForm.ppm')}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            placeholder={feeRate || '1'}
                            placeholderTextColor="darkgray"
                            value={newFeeRatePPM}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newFeeRatePPM: text
                                })
                            }
                            numberOfLines={1}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.textInput}
                        />

                        <Text style={styles.text}>
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
                            style={styles.textInput}
                        />

                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'components.SetFeesForm.submit'
                                )}
                                onPress={() => {
                                    setFees(
                                        newBaseFee,
                                        newFeeRatePPM,
                                        Number(newTimeLockDelta),
                                        channelPoint,
                                        channelId
                                    ).then(() => {
                                        if (
                                            channelId &&
                                            implementation === 'lnd'
                                        ) {
                                            ChannelsStore.getChannelInfo(
                                                channelId
                                            );
                                        }
                                    });
                                    this.setState({ feesSubmitted: true });
                                }}
                                buttonStyle={{
                                    backgroundColor: '#261339',
                                    borderRadius: 30
                                }}
                            />
                        </View>
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        color: themeColor('text')
    },
    textInput: {
        fontSize: 20,
        color: themeColor('text')
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
