import * as React from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Button from './../../components/Button';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import UrlUtils from './../../utils/UrlUtils';
import SettingsStore from './../../stores/SettingsStore';

interface SetPINProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface SetPINState {
    passphrase: string;
    passphraseConfirm: string;
    passphraseError: boolean;
}

@inject('SettingsStore')
@observer
export default class SetPIN extends React.Component<SetPINProps, SetPINState> {
    state = {
        passphrase: '',
        passphraseConfirm: '',
        passphraseError: false
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
        const { passphrase, passphraseConfirm } = this.state;
        const { getSettings, setSettings } = SettingsStore;

        if (passphrase !== passphraseConfirm) {
            this.setState({
                passphraseError: true
            });

            return;
        }

        const settings = await getSettings();
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
                          passphrase
                      }
                    : { passphrase }
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
        const { passphrase, passphraseConfirm, passphraseError } = this.state;
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
                        text: localeString('views.Settings.SetPassword.title'),
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('secondary')}
                />
                {passphraseError && (
                    <Text
                        style={{
                            color: 'red',
                            textAlign: 'center',
                            padding: 20
                        }}
                    >
                        Passphrases do not match
                    </Text>
                )}
                <Text
                    style={{
                        color: themeColor('text'),
                        paddingLeft: 10,
                        paddingTop: 10
                    }}
                >
                    {localeString('views.Settings.newPassword')}
                </Text>
                <TextInput
                    placeholder={'********'}
                    placeholderTextColor="darkgray"
                    value={passphrase}
                    onChangeText={(text: string) =>
                        this.setState({
                            passphrase: text,
                            passphraseError: false
                        })
                    }
                    numberOfLines={1}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={true}
                    style={{
                        fontSize: 20,
                        color: themeColor('text'),
                        paddingLeft: 10
                    }}
                />
                <Text
                    style={{
                        color: themeColor('text'),
                        paddingLeft: 10
                    }}
                >
                    {localeString('views.Settings.confirmPassword')}
                </Text>
                <TextInput
                    placeholder={'********'}
                    placeholderTextColor="darkgray"
                    value={passphraseConfirm}
                    onChangeText={(text: string) =>
                        this.setState({
                            passphraseConfirm: text,
                            passphraseError: false
                        })
                    }
                    numberOfLines={1}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={true}
                    style={{
                        fontSize: 20,
                        color: themeColor('text'),
                        paddingLeft: 10
                    }}
                />
                <View style={{ paddingTop: 10, margin: 10 }}>
                    <Button
                        title={localeString('views.Settings.SetPassword.save')}
                        icon={{
                            name: 'save',
                            size: 25,
                            color: 'white'
                        }}
                        onPress={() => this.saveSettings()}
                    />
                </View>
            </View>
        );
    }
}
