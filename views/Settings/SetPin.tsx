import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import SettingsStore from '../../stores/SettingsStore';
import Pin from '../../components/Pin';

interface SetPinProps {
    navigation: any;
    SettingsStore: SettingsStore;
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
        const { SettingsStore, navigation } = this.props;
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
            setLoginStatus(false);
            getSettings();
            navigation.navigate('Settings', {
                refresh: true
            });
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { pin, pinMismatchError, pinInvalidError } = this.state;
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
                                typeof typeof settings.scramblePin ===
                                    'undefined') && (
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
            </View>
        );
    }
}

const styles = StyleSheet.create({
    mainText: {
        fontFamily: 'Lato-Regular',
        fontSize: 20,
        textAlign: 'center',
        marginTop: 10
    },
    secondaryText: {
        fontFamily: 'Lato-Regular',
        textAlign: 'center'
    }
});
