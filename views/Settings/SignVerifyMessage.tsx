import * as React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput
} from 'react-native';
import { ButtonGroup, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Button from './../../components/Button';
import { themeColor } from './../../utils/ThemeUtils';
import { localeString } from './../../utils/LocaleUtils';
import MessageSignStore from './../../stores/MessageSignStore';
import CopyButton from './../../components/CopyButton';

interface SignVerifyMessageProps {
    navigation: any;
    MessageSignStore: MessageSignStore;
}

interface SignVerifyMessageState {
    messageToSign: string;
    messageToVerify: string;
    selectedIndex: number;
}

@inject('SettingsStore', 'MessageSignStore')
@observer
export default class SignVerifyMessage extends React.Component<
    SignVerifyMessageProps,
    SignVerifyMessageState
> {
    state = {
        messageToSign: '',
        messageToVerify: '',
        selectedIndex: 0
    };

    componentDidMount() {
        const { MessageSignStore } = this.props;
        MessageSignStore.reset();
    }

    reset = () => {
        this.setState({
            messageToSign: '',
            messageToVerify: ''
        });

        MessageSignStore.reset();
    };

    updateIndex = (selectedIndex: number) => {
        this.setState({
            selectedIndex
        });
    };

    render() {
        const { navigation, MessageSignStore } = this.props;
        const { messageToSign, messageToVerify, selectedIndex } = this.state;
        const { loading, signMessage, verifyMessage, error, signature } =
            MessageSignStore;

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

        const signButton = () => (
            <React.Fragment>
                <Text
                    style={{ color: selectedIndex === 1 ? 'white' : 'black' }}
                >
                    {localeString('views.Settings.SignMessage.sign')}
                </Text>
            </React.Fragment>
        );

        const verifyButton = () => (
            <React.Fragment>
                <Text
                    style={{ color: selectedIndex === 0 ? 'white' : 'black' }}
                >
                    {localeString('views.Settings.SignMessage.verify')}
                </Text>
            </React.Fragment>
        );

        const buttons = [{ element: signButton }, { element: verifyButton }];

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

                <ButtonGroup
                    onPress={this.updateIndex}
                    selectedIndex={selectedIndex}
                    buttons={buttons}
                    selectedButtonStyle={{
                        backgroundColor: themeColor('highlight'),
                        borderRadius: 12
                    }}
                    containerStyle={{
                        backgroundColor: themeColor('secondary'),
                        borderRadius: 12,
                        borderColor: themeColor('secondary')
                    }}
                    innerBorderStyle={{
                        color: themeColor('secondary')
                    }}
                />

                {loading && <ActivityIndicator size="large" />}
                {error && <Text style={styles.error}>{error}</Text>}

                {selectedIndex === 0 && (
                    <View>
                        <View style={styles.form}>
                            <Text style={{ color: themeColor('text') }}>
                                {localeString(
                                    'views.Settings.SignMessage.messageToSign'
                                )}
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
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
                                editable={!loading}
                                placeholderTextColor="gray"
                                multiline
                            />
                        </View>

                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.SignMessage.sign'
                                )}
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
                            <View>
                                <View style={styles.form}>
                                    <Text style={{ color: themeColor('text') }}>
                                        {localeString(
                                            'views.Settings.SignMessage.generatedSignature'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.textInput,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {signature}
                                    </Text>
                                </View>

                                <View style={styles.button}>
                                    <CopyButton copyValue={signature} />
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {selectedIndex === 1 && (
                    <View>
                        <View style={styles.form}>
                            <Text
                                style={{
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Settings.SignMessage.host'
                                )}
                            </Text>
                            <TextInput
                                placeholder={localeString(
                                    'views.Settings.SignMessage.placeHolder'
                                )}
                                value={messageToVerify}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        messageToVerify: text
                                    })
                                }
                                style={{
                                    ...styles.textInput,
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
                                title={localeString(
                                    'views.Settings.SignMessage.verify'
                                )}
                                icon={{
                                    name: 'create',
                                    size: 25,
                                    color: 'white'
                                }}
                                onPress={() => verifyMessage(messageToVerify)}
                                buttonStyle={{
                                    backgroundColor: '#261339',
                                    borderRadius: 30
                                }}
                                titleStyle={{
                                    color: 'white'
                                }}
                            />
                        </View>
                    </View>
                )}

                {signature && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.SignMessage.clear'
                            )}
                            onPress={() => MessageSignStore.reset()}
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
        padding: 10
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    textInput: {
        fontSize: 20,
        width: '100%',
        top: 10,
        backgroundColor: '#31363F',
        borderRadius: 6,
        marginBottom: 20,
        paddingLeft: 5
    }
});
