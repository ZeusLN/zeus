import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import SettingsStore from '../../stores/SettingsStore';
import PinPad from '../../components/PinPad';

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

    saveSettings = async () => {
        const { SettingsStore, navigation } = this.props;
        const { pin, pinConfirm } = this.state;
        const { getSettings, setSettings, setLoginStatus } = SettingsStore;

        if (pin !== pinConfirm) {
            this.setState({
                pinMismatchError: true
            });

            return;
        }

        const settings = await getSettings();

        if (pin === settings.duressPin) {
            this.setState({
                pinInvalidError: true
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
                          passphrase: settings.passphrase,
                          duressPassphrase: settings.duressPassphrase,
                          duressPin: settings.duressPin,
                          pin
                      }
                    : { pin }
            )
        ).then(() => {
            setLoginStatus(false);
            getSettings();
            navigation.navigate('Settings', {
                refresh: true
            });
        });
    };

    render() {
        const { navigation } = this.props;
        const { pin, pinConfirm, pinMismatchError, pinInvalidError } =
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
                    centerComponent={{
                        text: localeString('views.Settings.SetPin.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View
                    style={{
                        paddingLeft: 15,
                        paddingRight: 15,
                        paddingTop: 10
                    }}
                >
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
                    <PinPad pin={true} />
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
    }
});
