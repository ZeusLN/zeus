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
import { themeColor } from './../../utils/ThemeUtils';
import { localeString } from './../../utils/LocaleUtils';
import MessageSignStore from './../../stores/MessageSignStore';
import CopyButton from './../../components/CopyButton';

interface SignMessageProps {
    navigation: any;
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
        const { navigation, MessageSignStore } = this.props;
        const { messageToSign } = this.state;
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
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Settings.SignMessage.title'),
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('secondary')}
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
                            color: themeColor('text')
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
                        style={{
                            fontSize: 20,
                            color: themeColor('text')
                        }}
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
                            backgroundColor: '#261339',
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
                                backgroundColor: '#261339',
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
