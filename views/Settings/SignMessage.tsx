import * as React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput
} from 'react-native';
import { Button, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { localeString } from './../../utils/LocaleUtils';
import SettingsStore from './../../stores/SettingsStore';
import MessageSignStore from './../../stores/MessageSignStore';
import CopyButton from './../../components/CopyButton';

interface SignMessageProps {
    navigation: any;
    SettingsStore: SettingsStore;
    MessageSignStore: MessageSignStore;
}

interface SignMessageState {
    messageToSign: string;
}

@inject('SettingsStore', 'MessageSignStore')
@observer
export default class SignMessage extends React.Component<
    SignMessageProps,
    SignMessageState
> {
    state = {
        messageToSign: ''
    };

    componentDidMount() {
        const { MessageSignStore } = this.props;
        MessageSignStore.resetSignature();
    }

    render() {
        const { navigation, SettingsStore, MessageSignStore } = this.props;
        const { messageToSign } = this.state;
        const { settings } = SettingsStore;
        const { theme } = settings;
        const { loading, signMessage, error, signature } = MessageSignStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() =>
                    navigation.navigate('Settings', { refresh: true })
                }
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Settings.SignMessage.title'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor={
                        theme === 'dark' ? '#261339' : 'rgba(92, 99,216, 1)'
                    }
                />

                {loading && <ActivityIndicator size="large" />}
                {error && <Text style={styles.error}>{error}</Text>}
                {signature && (
                    <Text style={{ color: 'green' }}>{signature}</Text>
                )}
                {signature && (
                    <CopyButton
                        copyValue={signature}
                        title={localeString(
                            'views.Settings.SignMessage.copyButton'
                        )}
                    />
                )}

                <View style={styles.form}>
                    <Text
                        style={{
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                    >
                        {localeString('views.Settings.SignMessage.host')}
                    </Text>
                    <TextInput
                        placeholder={localeString(
                            'views.Settings.SignMessage.placeHolder'
                        )}
                        value={messageToSign}
                        onChangeText={(text: string) =>
                            this.setState({
                                messageToSign: text
                            })
                        }
                        style={
                            theme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        editable={!loading}
                        placeholderTextColor="gray"
                        multiline
                        numberOfLines={3}
                    />
                </View>

                <View style={styles.button}>
                    <Button
                        title={localeString('views.Settings.SignMessage.sign')}
                        icon={{
                            name: 'create',
                            size: 25,
                            color: 'white'
                        }}
                        onPress={() => signMessage(messageToSign)}
                        buttonStyle={{
                            backgroundColor:
                                theme === 'dark'
                                    ? '#261339'
                                    : 'rgba(92, 99,216, 1)',
                            borderRadius: 30
                        }}
                        titleStyle={{
                            color: 'white'
                        }}
                    />
                </View>

                {signature && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.SignMessage.clear'
                            )}
                            onPress={() => MessageSignStore.resetSignature()}
                            buttonStyle={{
                                backgroundColor:
                                    theme === 'dark'
                                        ? '#261339'
                                        : 'rgba(92, 99,216, 1)',
                                borderRadius: 30
                            }}
                            titleStyle={{
                                color: 'white'
                            }}
                        />
                    </View>
                )}
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
    },
    textInput: {
        fontSize: 20,
        color: 'black'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white'
    },
    error: {
        color: 'red'
    },
    button: {
        padding: 5
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5
    }
});
