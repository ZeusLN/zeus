import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from 'react-native-elements';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import { inject, observer } from 'mobx-react';

import FeeStore from './../stores/FeeStore';

interface SetFeesFormProps {
    FeeStore: FeeStore;
    baseFeeMsat?: string;
    feeRate?: string;
    channelPoint?: string;
    channelId?: string;
    expanded?: boolean;
}

interface SetFeesFormState {
    showNewFeesForm: boolean;
    feesSubmitted: boolean;
    newBaseFeeMsat: string;
    newFeeRatePPM: string;
    timeLockDelta: string;
}

@inject('FeeStore')
@observer
export default class SetFeesForm extends React.Component<
    SetFeesFormProps,
    SetFeesFormState
> {
    state = {
        showNewFeesForm: false,
        feesSubmitted: false,
        newBaseFeeMsat: '1',
        newFeeRatePPM: '1',
        timeLockDelta: '144'
    };

    render() {
        const {
            showNewFeesForm,
            feesSubmitted,
            newBaseFeeMsat,
            newFeeRatePPM,
            timeLockDelta
        } = this.state;
        const {
            FeeStore,
            baseFeeMsat,
            feeRate,
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
                            placeholder={baseFeeMsat || '1'}
                            placeholderTextColor="darkgray"
                            value={newBaseFeeMsat}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newBaseFeeMsat: text
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
                            placeholder={'144'}
                            placeholderTextColor="darkgray"
                            value={timeLockDelta}
                            onChangeText={(text: string) =>
                                this.setState({
                                    timeLockDelta: text
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
                                        newBaseFeeMsat,
                                        newFeeRatePPM,
                                        Number(timeLockDelta),
                                        channelPoint,
                                        channelId
                                    );
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
