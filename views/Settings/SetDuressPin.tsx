import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Pin from '../../components/Pin';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import SettingsStore from '../../stores/SettingsStore';

interface SetDuressPinProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface SetDuressPinState {
    duressPin: string;
    duressPinConfirm: string;
    duressPinMismatchError: boolean;
    duressPinInvalidError: boolean;
    duressPinSaveError: boolean;
    saving: boolean;
}

@inject('SettingsStore')
@observer
export default class SetDuressPin extends React.Component<
    SetDuressPinProps,
    SetDuressPinState
> {
    state = {
        duressPin: '',
        duressPinConfirm: '',
        duressPinMismatchError: false,
        duressPinInvalidError: false,
        duressPinSaveError: false,
        saving: false
    };

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    onSubmit = (value: string, pinConfirm?: boolean) => {
        if (!pinConfirm) {
            this.setState({
                duressPin: value,
                duressPinMismatchError: false,
                duressPinInvalidError: false,
                duressPinSaveError: false
            });
        } else {
            this.setState({ duressPinConfirm: value }, () => {
                this.saveSettings();
            });
        }
    };

    onPinChange = () => {
        this.setState({
            duressPinMismatchError: false,
            duressPinInvalidError: false,
            duressPinSaveError: false
        });
    };

    saveSettings = async () => {
        const { SettingsStore, navigation } = this.props;
        const { duressPin, duressPinConfirm } = this.state;
        const { settings, updateSettings } = SettingsStore;

        if (duressPin !== duressPinConfirm) {
            this.setState({
                duressPinMismatchError: true,
                duressPin: '',
                duressPinConfirm: ''
            });

            return;
        }

        // In-memory settings are current here: every write of pin/duressPin
        // goes through updateSettings, which updates this.settings once the
        // write has landed, and those flows only navigate afterwards.
        // Re-reading the keychain would only add latency and a full
        // re-render.
        if (duressPin === settings.pin) {
            this.setState({
                duressPinInvalidError: true,
                duressPin: '',
                duressPinConfirm: ''
            });

            return;
        }

        this.setState({ saving: true });
        try {
            await updateSettings({ duressPin });
        } catch (error) {
            console.error('Could not save duress PIN', error);
            this.setState({ saving: false, duressPinSaveError: true });
            return;
        }

        navigation.popTo('Security');
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const {
            duressPin,
            duressPinMismatchError,
            duressPinInvalidError,
            duressPinSaveError,
            saving
        } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    rightComponent={
                        saving ? <LoadingIndicator size={30} /> : undefined
                    }
                    navigation={navigation}
                />
                <View
                    style={{
                        paddingTop: 10,
                        flex: 1
                    }}
                >
                    <View style={{ flex: 1 }}>
                        {duressPinMismatchError && (
                            <ErrorMessage
                                message={localeString(
                                    'views.Settings.SetPin.noMatch'
                                )}
                            />
                        )}
                        {duressPinInvalidError && (
                            <ErrorMessage
                                message={localeString(
                                    'views.Settings.SetPin.invalid'
                                )}
                            />
                        )}
                        {duressPinSaveError && (
                            <ErrorMessage
                                message={localeString(
                                    'views.Settings.SetPin.saveError'
                                )}
                            />
                        )}
                    </View>
                    {!duressPin && (
                        <>
                            <Text
                                style={{
                                    ...styles.mainText,
                                    color: themeColor('text'),
                                    flex: 1,
                                    justifyContent: 'flex-end'
                                }}
                            >
                                {localeString(
                                    'views.Settings.SetDuressPin.createDuressPin'
                                )}
                            </Text>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText'),
                                    flex: 1,
                                    justifyContent: 'flex-end'
                                }}
                            >
                                {localeString(
                                    'views.Settings.SetDuressPin.duressPinExplanation'
                                )}
                            </Text>
                            <View
                                style={{
                                    flex: 6,
                                    justifyContent: 'flex-end'
                                }}
                            >
                                <Pin
                                    onSubmit={this.onSubmit}
                                    onPinChange={this.onPinChange}
                                    hidePinLength={true}
                                    pinConfirm={false}
                                    shuffle={settings.scramblePin}
                                />
                            </View>
                        </>
                    )}
                    {!!duressPin && (
                        <>
                            <Text
                                style={{
                                    ...styles.mainText,
                                    color: themeColor('text'),
                                    flex: 1,
                                    justifyContent: 'flex-end'
                                }}
                            >
                                {localeString(
                                    'views.Settings.SetDuressPin.confirmDuressPin'
                                )}
                            </Text>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText'),
                                    flex: 1,
                                    justifyContent: 'flex-end'
                                }}
                            >
                                {localeString(
                                    'views.Settings.SetDuressPin.duressPinExplanation'
                                )}
                            </Text>
                            <View
                                style={{
                                    flex: 6,
                                    justifyContent: 'flex-end'
                                }}
                            >
                                <Pin
                                    onSubmit={this.onSubmit}
                                    onPinChange={this.onPinChange}
                                    hidePinLength={false}
                                    pinConfirm={true}
                                    pinLength={duressPin.length}
                                    shuffle={settings.scramblePin}
                                    disabled={saving}
                                />
                            </View>
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    mainText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 20,
        textAlign: 'center',
        marginTop: 10
    },
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        marginLeft: 10,
        marginRight: 10
    }
});
