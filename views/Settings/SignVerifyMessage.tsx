import * as React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { ButtonGroup } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import CopyButton from '../../components/CopyButton';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import {
    SuccessMessage,
    ErrorMessage
} from '../../components/SuccessErrorMessage';
import TextInput from '../../components/TextInput';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import MessageSignStore from '../../stores/MessageSignStore';

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
        const { navigation } = this.props;
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
        } = this.props.MessageSignStore;

        const signButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 1
                                ? themeColor('text')
                                : themeColor('background')
                    }}
                >
                    {localeString('views.Settings.SignMessage.sign')}
                </Text>
            </React.Fragment>
        );

        const verifyButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 0
                                ? themeColor('text')
                                : themeColor('background')
                    }}
                >
                    {localeString('views.Settings.SignMessage.verify')}
                </Text>
            </React.Fragment>
        );

        const buttons = [{ element: signButton }, { element: verifyButton }];

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.SignMessage.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />

                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
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

                    {loading && <LoadingIndicator />}

                    {selectedIndex === 0 && (
                        <View>
                            <View style={styles.form}>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText')
                                    }}
                                >
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
                                    locked={loading}
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
                                        name: 'create'
                                    }}
                                    onPress={() => signMessage(messageToSign)}
                                />
                            </View>

                            {signature && (
                                <View>
                                    <View style={styles.form}>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
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
                                        ...styles.text,
                                        color: themeColor('secondaryText')
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
                                    locked={loading}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            <View style={styles.form}>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('secondaryText')
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
                                    locked={loading}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            {valid && (
                                <SuccessMessage
                                    message={`${localeString(
                                        'views.Settings.SignMessage.success'
                                    )} ${pubkey}`}
                                />
                            )}

                            {(error || valid === false) && (
                                <ErrorMessage
                                    message={
                                        error
                                            ? error
                                            : localeString(
                                                  'views.Settings.SignMessage.error'
                                              )
                                    }
                                />
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
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        padding: 10
    },
    button: {
        padding: 10
    },
    form: {
        paddingTop: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    text: {
        fontFamily: 'Lato-Regular'
    },
    textInput: {
        fontSize: 20,
        width: '100%',
        top: 10,
        backgroundColor: '#31363F',
        borderRadius: 6,
        marginBottom: 20,
        padding: 10
    }
});
