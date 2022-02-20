import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from './../components/Button';
import { ErrorMessage } from './../components/SuccessErrorMessage';
import TextInput from './../components/TextInput';

import LinkingUtils from './../utils/LinkingUtils';
import { localeString } from './../utils/LocaleUtils';

import SettingsStore from './../stores/SettingsStore';

interface LockscreenProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface LockscreenState {
    passphrase: string;
    passphraseAttempt: string;
    duressPassphrase: string;
    hidden: boolean;
    error: boolean;
}

@inject('SettingsStore')
@observer
export default class Lockscreen extends React.Component<
    LockscreenProps,
    LockscreenState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            passphraseAttempt: '',
            passphrase: '',
            duressPassphrase: '',
            hidden: true,
            error: false
        };
    }

    UNSAFE_componentWillMount() {
        const { SettingsStore, navigation } = this.props;
        const { getSettings } = SettingsStore;
        getSettings().then((settings: any) => {
            if (settings && settings.passphrase) {
                this.setState({ passphrase: settings.passphrase });
                if (settings.duressPassphrase) {
                    this.setState({ duressPassphrase: settings.duressPassphrase })
                }
            } else if (
                settings &&
                settings.nodes &&
                settings.nodes.length > 0
            ) {
                navigation.navigate('Wallet');
            } else {
                navigation.navigate('IntroSplash');
            }
        });
    }

    onInputLabelPressed = () => {
        this.setState({ hidden: !this.state.hidden });
    };

    onAttemptLogIn = () => {
        const { SettingsStore, navigation } = this.props;
        const { passphrase, duressPassphrase, passphraseAttempt } = this.state;

        this.setState({
            error: false
        });

        if (passphraseAttempt === passphrase) {
            SettingsStore.setLoginStatus(true);
            LinkingUtils.handleInitialUrl(navigation);
            navigation.navigate('Wallet');
        } else if (duressPassphrase && passphraseAttempt === duressPassphrase) {
            SettingsStore.setLoginStatus(true);
            LinkingUtils.handleInitialUrl(navigation);
            this.deleteNodes();
        } else if (passphraseAttempt ) {

        } else {
            this.setState({
                error: true
            });
        }
    };

    deleteNodes = () => {
        const { SettingsStore, navigation } = this.props;
        const { setSettings, settings } = SettingsStore;

        setSettings(
            JSON.stringify({
                nodes: undefined,
                selectedNode: undefined,
                theme: settings.theme,
                passphrase: settings.passphrase,
                duressPassphrase: settings.duressPassphrase,
                fiat: settings.fiat,
                locale: settings.locale,
                privacy: settings.privacy
            })
        ).then(() => {
            navigation.navigate('Wallet');
        });
    };

    render() {
        const { passphrase, passphraseAttempt, hidden, error } = this.state;

        return (
            <ScrollView style={styles.container}>
                {!!passphrase && (
                    <View style={styles.content}>
                        {error && (
                            <ErrorMessage
                                message={localeString(
                                    'views.Lockscreen.incorrect'
                                )}
                            />
                        )}
                        <Text
                            style={{
                                color: '#A7A9AC',
                                fontFamily: 'Lato-Regular'
                            }}
                        >
                            {localeString('views.Lockscreen.passphrase')}
                        </Text>
                        <TextInput
                            placeholder={'****************'}
                            placeholderTextColor="darkgray"
                            value={passphraseAttempt}
                            onChangeText={(text: string) =>
                                this.setState({
                                    passphraseAttempt: text,
                                    error: false
                                })
                            }
                            numberOfLines={1}
                            autoCapitalize="none"
                            autoCorrect={false}
                            secureTextEntry={hidden}
                            autoFocus={true}
                            style={styles.textInput}
                        />
                        <View style={styles.button}>
                            <Button
                                title={
                                    hidden
                                        ? localeString('general.show')
                                        : localeString('general.hide')
                                }
                                onPress={() => this.onInputLabelPressed()}
                                containerStyle={{ width: 300 }}
                                adaptiveWidth
                                secondary
                            />
                        </View>
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.Lockscreen.login')}
                                onPress={() => this.onAttemptLogIn()}
                                containerStyle={{ width: 300 }}
                                adaptiveWidth
                            />
                        </View>
                    </View>
                )}
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        marginTop: 100,
        paddingLeft: 20,
        paddingRight: 20,
        alignItems: 'center'
    },
    container: {
        flex: 1,
        backgroundColor: '#1f2328'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    },
    textInput: {
        textAlign: 'center'
    }
});
