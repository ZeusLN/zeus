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

    saveSettings = async () => {
        const { SettingsStore, navigation } = this.props;
        const { duressPin, duressPinConfirm } = this.state;
        const { getSettings, setSettings } = SettingsStore;

        if (duressPin !== duressPinConfirm) {
            this.setState({
                duressPinMismatchError: true
            });

            return;
        }

        const settings = await getSettings();

        if (duressPin === settings.pin) {
            this.setState({
                duressPinInvalidError: true
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
                          pin: settings.pin,
                          duressPin
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
        const { navigation } = this.props;
        const {
            duressPin,
            duressPinConfirm,
            duressPinMismatchError,
            duressPinInvalidError
        } = this.state;
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
                    <Pin />
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
