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
    signatureToVerify: string;
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
        signatureToVerify: '',
        selectedIndex: 0
    };

    componentDidMount() {
        const { MessageSignStore } = this.props;
        MessageSignStore.reset();
    }

    reset = () => {
        const { MessageSignStore } = this.props;

        this.setState({
            messageToSign: '',
            messageToVerify: '',
            signatureToVerify: ''
        });

        MessageSignStore.reset();
    };

    updateIndex = (selectedIndex: number) => {
        const { MessageSignStore } = this.props;

        this.setState({
            selectedIndex,
            messageToSign: '',
            messageToVerify: '',
            signatureToVerify: ''
        });

        MessageSignStore.reset();
    };

    render() {
        const { navigation, MessageSignStore } = this.props;
        const {
            messageToSign,
            messageToVerify,
            signatureToVerify,
            selectedIndex
        } = this.state;
        const {
            loading,
            signMessage,
            verifyMessage,
            pubkey,
            valid,
            error,
            signature
        } = MessageSignStore;

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
                        backgroundColor: themeColor('text'),
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
                                numberOfLines={3}
                            />
                        </View>

                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.signMessage.button'
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
                                    'views.Settings.SignMessage.messageToVerify'
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

                        <View style={styles.form}>
                            <Text
                                style={{
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'views.Settings.SignMessage.signatureToVerify'
                                )}
                            </Text>
                            <TextInput
                                value={signatureToVerify}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        signatureToVerify: text
                                    })
                                }
                                style={{
                                    ...styles.textInput,
                                    color: themeColor('text')
                                }}
                                editable={!loading}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {valid && (
                            <Text style={styles.successField}>
                                {`${localeString(
                                    'views.Settings.SignMessage.success'
                                )} ${pubkey}`}
                            </Text>
                        )}

                        {valid === false && (
                            <Text style={styles.errorField}>
                                {localeString(
                                    'views.Settings.SignMessage.error'
                                )}
                            </Text>
                        )}

                        <View style={styles.button}>
                            <Button
                                title={localeString(
                                    'views.Settings.signMessage.buttonVerify'
                                )}
                                onPress={() =>
                                    verifyMessage({
                                        msg: messageToVerify,
                                        signature: signatureToVerify
                                    })
                                }
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

                {pubkey && (
                    <View style={styles.button}>
                        <CopyButton
                            title={localeString(
                                'views.Settings.SignMessage.copyPubkey'
                            )}
                            copyValue={pubkey}
                        />
                    </View>
                )}

                {(signature || !!valid) && (
                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.SignMessage.clear'
                            )}
                            onPress={() => this.reset()}
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
        padding: 10
    },
    successField: {
        fontSize: 20,
        width: '100%',
        top: 10,
        color: '#41CF3E',
        backgroundColor: '#273832',
        borderRadius: 6,
        marginBottom: 20,
        padding: 15
    },
    errorField: {
        fontSize: 20,
        width: '100%',
        top: 10,
        color: '#E14C4C',
        backgroundColor: '#372C33',
        borderRadius: 6,
        marginBottom: 20,
        padding: 15
    }
});
