import * as React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import Button from './../components/Button';
import { ErrorMessage } from './../components/SuccessErrorMessage';
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
        const { passphrase, passphraseAttempt } = this.state;

        this.setState({
            error: false
        });

        if (passphraseAttempt === passphrase) {
            SettingsStore.setLoginStatus(true);
            LinkingUtils.handleInitialUrl(navigation);
            navigation.navigate('Wallet');
        } else {
            this.setState({
                error: true
            });
        }
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
                        <Text style={{ color: 'white' }}>
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
                            style={styles.textInputDark}
                            autoFocus={true}
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
        backgroundColor: 'black',
        paddingTop: 200
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    },
    buttons: {
        paddingTop: 20,
        paddingBottom: 20,
        width: '100%'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white',
        textAlign: 'center'
    }
});
