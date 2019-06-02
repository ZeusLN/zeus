import * as React from 'react';
import { TouchableOpacity, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button } from 'react-native-elements';

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
export default class Lockscreen extends React.Component<LockscreenProps, LockscreenState> {
    constructor(props: any) {
        super(props);
        this.state = {
            passphraseAttempt: '',
            passphrase: '',
            hidden: true,
            error: false
        }
    }

    componentWillMount() {
        const { SettingsStore, navigation } = this.props;
        const { getSettings } = SettingsStore;
        getSettings().then((settings: any) => {
            if (!settings.passphrase) {
                navigation.navigate('Wallet');
            } else {
                this.setState({ passphrase: settings.passphrase });
            }
        });
    }

    onInputLabelPressed = () => {
        this.setState({ hidden:!this.state.hidden });
    };

    onAttemptLogIn = () => {
          const { navigation } = this.props;
          const { passphrase, passphraseAttempt } = this.state;

          this.setState({
              error: false
          });

          if (passphraseAttempt === passphrase) {
              navigation.navigate('Wallet');
          } else {
              this.setState({
                  error: true
              });
          }
    }

    render() {
        const { passphrase, passphraseAttempt, hidden, error } = this.state;

        return (
            <ScrollView style={styles.darkThemeStyle}>
                {!!passphrase && <View style={styles.content}>
                    {error && <Text style={{ color: 'red' }}>Incorrect Passphrase</Text>}
                    <Text style={{ color: 'white' }}>Passphrase</Text>
                    <TextInput
                        placeholder={'****************'}
                        placeholderTextColor='darkgray'
                        value={passphraseAttempt}
                        onChangeText={(text: string) => this.setState({ passphraseAttempt: text, error: false })}
                        numberOfLines={1}
                        autoCapitalize='none'
                        autoCorrect={false}
                        secureTextEntry={hidden}
                        style={styles.textInputDark}
                      />
                      <TouchableOpacity onPress={this.onInputLabelPressed}>
                          <Text>
                              {hidden ? 'Show' : 'Hide'}
                          </Text>
                      </TouchableOpacity>
                      <Button
                          title="Log In"
                          buttonStyle={{
                              backgroundColor: 'orange'
                          }}
                          onPress={() => this.onAttemptLogIn()}
                      />
                </View>}
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
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    },
    buttons: {
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 20
    },
    textInputDark: {
        fontSize: 20,
        color: 'white',
        textAlign: 'center'
    }
});