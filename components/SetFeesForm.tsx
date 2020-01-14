import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import FeeStore from './../stores/FeeStore';
import SettingsStore from './../stores/SettingsStore';

interface SetFeesFormProps {
    SettingsStore: SettingsStore;
    FeeStore: FeeStore;
    baseFeeMsat?: string;
    feeRate?: string;
    channelPoint?: string;
    channelId?: string;
}

interface SetFeesFormState {
    showNewFeesForm: boolean;
    feesSubmitted: boolean;
    newBaseFeeMsat: string;
    newFeeRateMiliMsat: string;
}

@inject('SettingsStore', 'FeeStore')
@observer
export default class SetFeesForm extends React.Component<
    SetFeesFormProps,
    SetFeesFormState
> {
    state = {
        showNewFeesForm: false,
        feesSubmitted: false,
        newBaseFeeMsat: '1',
        newFeeRateMiliMsat: '1000000'
    };

    render() {
        const {
            showNewFeesForm,
            feesSubmitted,
            newBaseFeeMsat,
            newFeeRateMiliMsat
        } = this.state;
        const {
            SettingsStore,
            FeeStore,
            baseFeeMsat,
            feeRate,
            channelPoint,
            channelId
        } = this.props;
        const { settings } = SettingsStore;
        const { theme } = settings;
        const {
            channelFees,
            setFees,
            loading,
            setFeesError,
            setFeesSuccess
        } = FeeStore;

        return (
            <React.Fragment>
                <View style={styles.button}>
                    <Button
                        title={
                            showNewFeesForm
                                ? 'Hide Set New Fees Form'
                                : 'Set New Fees'
                        }
                        onPress={() =>
                            this.setState({ showNewFeesForm: !showNewFeesForm })
                        }
                        buttonStyle={{
                            backgroundColor: showNewFeesForm
                                ? 'black'
                                : 'green',
                            borderRadius: 30
                        }}
                    />
                </View>

                {showNewFeesForm && (
                    <React.Fragment>
                        {loading && (
                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                Setting fees, please wait...
                            </Text>
                        )}
                        {feesSubmitted && setFeesSuccess && (
                            <Text
                                style={{
                                    color: 'green'
                                }}
                            >
                                Succesfully set fees!
                            </Text>
                        )}
                        {feesSubmitted && setFeesError && (
                            <Text
                                style={{
                                    color: 'red'
                                }}
                            >
                                Error setting fees
                            </Text>
                        )}

                        <Text
                            style={{
                                color: theme === 'dark' ? 'white' : 'black'
                            }}
                        >
                            Base Fee msat
                        </Text>
                        <TextInput
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
                            style={
                                theme === 'dark'
                                    ? styles.textInputDark
                                    : styles.textInput
                            }
                        />
                        <Text
                            style={{
                                color: theme === 'dark' ? 'white' : 'black'
                            }}
                        >
                            Fee Rate mili msat
                        </Text>
                        <TextInput
                            placeholder={feeRate || '1000000'}
                            placeholderTextColor="darkgray"
                            value={newFeeRateMiliMsat}
                            onChangeText={(text: string) =>
                                this.setState({
                                    newFeeRateMiliMsat: text
                                })
                            }
                            numberOfLines={1}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={
                                theme === 'dark'
                                    ? styles.textInputDark
                                    : styles.textInput
                            }
                        />

                        <View style={styles.button}>
                            <Button
                                title={'Submit New Fees'}
                                onPress={() => {
                                    setFees(
                                        newBaseFeeMsat,
                                        newFeeRateMiliMsat,
                                        channelPoint,
                                        channelId
                                    );
                                    this.setState({ feesSubmitted: true });
                                }}
                                buttonStyle={{
                                    backgroundColor:
                                        theme === 'dark'
                                            ? '#261339'
                                            : 'rgba(92, 99,216, 1)',
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
    textInput: {
        fontSize: 20,
        color: 'black'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 10
    }
});
