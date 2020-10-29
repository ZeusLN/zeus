import * as React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from 'react-native-elements';
import { localeString } from './../utils/LocaleUtils';

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
    newFeeRatePPM: string;
}

export default class SetFeesForm extends React.Component<
    SetFeesFormProps,
    SetFeesFormState
> {
    state = {
        showNewFeesForm: false,
        feesSubmitted: false,
        newBaseFeeMsat: '1',
        newFeeRatePPM: '1'
    };

    render() {
        const {
            showNewFeesForm,
            feesSubmitted,
            newBaseFeeMsat,
            newFeeRatePPM
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
        const { setFees, loading, setFeesError, setFeesSuccess } = FeeStore;

        return (
            <React.Fragment>
                <View style={styles.button}>
                    <Button
                        title={
                            showNewFeesForm
                                ? localeString('components.SetFeesForm.hide')
                                : localeString('components.SetFeesForm.setNew')
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
                                {localeString('components.SetFeesForm.error')}
                            </Text>
                        )}

                        <Text
                            style={{
                                color: theme === 'dark' ? 'white' : 'black'
                            }}
                        >
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
                            style={
                                theme === 'dark'
                                    ? styles.textInputDark
                                    : styles.textInput
                            }
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
