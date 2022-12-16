import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import SettingsStore from '../../stores/SettingsStore';
import Pin from '../../components/Pin';

interface SetDuressPinProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface SetDuressPinState {
    duressPin: string;
    duressPinConfirm: string;
    duressPinMismatchError: boolean;
    duressPinInvalidError: boolean;
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
        duressPinInvalidError: false
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
                duressPinInvalidError: false
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
            duressPinInvalidError: false
        });
    };

    saveSettings = async () => {
        const { SettingsStore, navigation } = this.props;
        const { duressPin, duressPinConfirm } = this.state;
        const { getSettings, setSettings } = SettingsStore;

        if (duressPin !== duressPinConfirm) {
            this.setState({
                duressPinMismatchError: true,
                duressPin: '',
                duressPinConfirm: ''
            });

            return;
        }

        const settings = await getSettings();

        if (duressPin === settings.pin) {
            this.setState({
                duressPinInvalidError: true,
                duressPin: '',
                duressPinConfirm: ''
            });

            return;
        }

        await setSettings(
            JSON.stringify(
                settings
                    ? {
                          nodes: settings.nodes,
                          theme: settings.theme,
                          selectedNode: settings.selectedNode,
                          fiat: settings.fiat,
                          locale: settings.locale,
                          privacy: settings.privacy,
                          authenticationAttempts:
                              settings.authenticationAttempts,
                          passphrase: settings.passphrase,
                          duressPassphrase: settings.duressPassphrase,
                          pin: settings.pin,
                          duressPin,
                          scramblePin: settings.scramblePin,
                          loginBackground: settings.loginBackground
                      }
                    : { duressPin }
            )
        ).then(() => {
            getSettings();
            navigation.navigate('Settings', {
                refresh: true
            });
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { duressPin, duressPinMismatchError, duressPinInvalidError } =
            this.state;
        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
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
                                />
                            </View>
                        </>
                    )}
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    mainText: {
        fontFamily: 'Lato-Regular',
        fontSize: 20,
        textAlign: 'center',
        marginTop: 50
    },
    secondaryText: {
        fontFamily: 'Lato-Regular',
        textAlign: 'center'
    }
});
