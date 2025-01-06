import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../components/Header';
import Pin from '../../components/Pin';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface SetPinProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    route: any;
}

interface SetPinState {
    pin: string;
    pinConfirm: string;
    pinMismatchError: boolean;
    pinInvalidError: boolean;
}

@inject('SettingsStore')
@observer
export default class SetPin extends React.Component<SetPinProps, SetPinState> {
    state = {
        pin: '',
        pinConfirm: '',
        pinMismatchError: false,
        pinInvalidError: false
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
                pin: value,
                pinMismatchError: false,
                pinInvalidError: false
            });
        } else {
            this.setState({ pinConfirm: value }, () => {
                this.saveSettings();
            });
        }
    };

    onPinChange = () => {
        this.setState({
            pinMismatchError: false,
            pinInvalidError: false
        });
    };

    saveSettings = async () => {
        const { SettingsStore, navigation, route } = this.props;
        const { pin, pinConfirm } = this.state;
        const { getSettings, updateSettings, setLoginStatus } = SettingsStore;

        if (pin !== pinConfirm) {
            this.setState({
                pinMismatchError: true,
                pin: '',
                pinConfirm: ''
            });

            return;
        }

        const settings = await getSettings();

        if (pin === settings.duressPin) {
            this.setState({
                pinInvalidError: true,
                pin: '',
                pinConfirm: ''
            });

            return;
        }

        await updateSettings({ pin }).then(() => {
            setLoginStatus(true);
            getSettings();
            navigation.popTo('Security', {
                enableBiometrics: route.params?.forBiometrics
            });
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { pin, pinMismatchError, pinInvalidError } = this.state;

        return (
            <Screen>
                <Header leftComponent="Back" navigation={navigation} />
                <View
                    style={{
                        paddingTop: 10,
                        flex: 1
                    }}
                >
                    <View style={{ flex: 1 }}>
                        {pinMismatchError && (
                            <ErrorMessage
                                message={localeString(
                                    'views.Settings.SetPin.noMatch'
                                )}
                            />
                        )}
                        {pinInvalidError && (
                            <ErrorMessage
                                message={localeString(
                                    'views.Settings.SetPin.invalid'
                                )}
                            />
                        )}
                    </View>
                    {!pin && (
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
                                    'views.Settings.SetPin.createPin'
                                )}
                            </Text>
                            {(settings.scramblePin ||
                                settings.scramblePin == null) && (
                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText'),
                                        flex: 1,
                                        justifyContent: 'flex-end',
                                        marginLeft: 10,
                                        marginRight: 10
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.SetPin.scramblePin'
                                    )}
                                </Text>
                            )}
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
                    {!!pin && (
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
                                    'views.Settings.SetPin.confirmPin'
                                )}
                            </Text>
                            {(settings.scramblePin ||
                                settings.scramblePin == null) && (
                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText'),
                                        flex: 1,
                                        justifyContent: 'flex-end'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.SetPin.scramblePin'
                                    )}
                                </Text>
                            )}
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
                                    pinLength={pin.length}
                                    shuffle={settings.scramblePin}
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
        textAlign: 'center'
    }
});
