import * as React from 'react';
import { StyleSheet, Text, View, ScrollView, Alert } from 'react-native';
import { ButtonGroup } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

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
import DropdownSetting from '../../components/DropdownSetting';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import backendUtils from '../../utils/BackendUtils';

import MessageSignStore from '../../stores/MessageSignStore';

interface SignVerifyMessageProps {
    navigation: StackNavigationProp<any, any>;
    route: RouteProp<any, any>;
    MessageSignStore: MessageSignStore;
}

interface SignVerifyMessageState {
    messageToSign: string;
    messageToVerify: string;
    signatureToVerify: string;
    selectedIndex: number;
    signingMethodIndex: number;
    verifyingAddress: string;
    signingMode: string;
    signingAddressLocal: string;
    supportsAddressMessageSigning: boolean;
}

interface Address {
    address: string;
    type: string;
    accountName?: string;
}

@inject('SettingsStore', 'MessageSignStore')
@observer
export default class SignVerifyMessage extends React.Component<
    SignVerifyMessageProps,
    SignVerifyMessageState
> {
    navigationFocusListener: any;

    state = {
        messageToSign: '',
        messageToVerify: '',
        signatureToVerify: '',
        selectedIndex: 0,
        signingMethodIndex: 0,
        verifyingAddress: '',
        signingMode: 'lightning',
        signingAddressLocal: '',
        supportsAddressMessageSigning: false
    };

    componentDidMount = () => {
        const { MessageSignStore } = this.props;
        MessageSignStore.reset();

        // Load addresses right away and also when the screen comes into focus
        if (backendUtils.supportsAddressMessageSigning()) {
            this.setState({ supportsAddressMessageSigning: true });
            MessageSignStore.loadAddresses();

            // Also reload addresses whenever the screen comes into focus
            this.navigationFocusListener = this.props.navigation.addListener(
                'focus',
                () => {
                    console.log(
                        'SignVerifyMessage screen focused - reloading addresses'
                    );
                    MessageSignStore.loadAddresses();
                }
            );
        }

        // If we have a message to verify from navigation, set it
        if (this.props.route.params?.message) {
            this.setState({
                messageToVerify: this.props.route.params.message,
                selectedIndex: 1 // Switch to Verify tab
            });
        }

        // If we have an address to verify from navigation, set it
        if (this.props.route.params?.address) {
            this.setState({
                verifyingAddress: this.props.route.params.address
            });
        }
    };

    componentDidUpdate(prevProps: SignVerifyMessageProps) {
        const { addresses, selectedAddress } = this.props.MessageSignStore;
        const { verifyingAddress, signingAddressLocal } = this.state;

        if (
            addresses &&
            addresses.length > 0 &&
            (!prevProps.MessageSignStore.addresses ||
                prevProps.MessageSignStore.addresses.length === 0)
        ) {
            if (!verifyingAddress) {
                this.setState({ verifyingAddress: addresses[0].address });
            }

            if (!signingAddressLocal && selectedAddress) {
                this.setState({ signingAddressLocal: selectedAddress });
            }
        }

        if (
            selectedAddress !== prevProps.MessageSignStore.selectedAddress &&
            !signingAddressLocal
        ) {
            this.setState({ signingAddressLocal: selectedAddress });
        }
    }

    reset = () => {
        const { MessageSignStore } = this.props;

        this.setState({
            messageToSign: '',
            messageToVerify: '',
            signatureToVerify: '',
            verifyingAddress: '',
            signingMode: 'lightning',
            signingAddressLocal: ''
        });

        MessageSignStore.reset();
    };

    updateIndex = (selectedIndex: number) => {
        const { MessageSignStore } = this.props;

        this.setState({
            selectedIndex,
            messageToSign: '',
            messageToVerify: '',
            signatureToVerify: '',
            verifyingAddress: '',
            signingMode: 'lightning',
            signingAddressLocal: ''
        });

        MessageSignStore.reset();
    };

    updateSigningMethod = (signingMethodIndex: number) => {
        const { MessageSignStore } = this.props;

        this.setState({
            signingMethodIndex,
            messageToSign: '',
            messageToVerify: '',
            signatureToVerify: '',
            verifyingAddress: '',
            signingMode: signingMethodIndex === 0 ? 'lightning' : 'onchain',
            signingAddressLocal: ''
        });

        // Set the signing mode in the store based on the index
        MessageSignStore.setSigningMode(
            signingMethodIndex === 0 ? 'lightning' : 'onchain'
        );
        MessageSignStore.reset();
    };

    renderSigningMethodSelector = () => {
        const { signingMethodIndex } = this.state;
        const { MessageSignStore } = this.props;
        const { addresses, selectedAddress } = MessageSignStore;

        const { supportsAddressMessageSigning } = this.state;

        if (!supportsAddressMessageSigning) {
            return null;
        }

        const lightningButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            signingMethodIndex === 0
                                ? themeColor('background')
                                : themeColor('text')
                    }}
                >
                    {localeString('views.Settings.SignMessage.lightningNode')}
                </Text>
            </React.Fragment>
        );

        const onchainButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            signingMethodIndex === 1
                                ? themeColor('background')
                                : themeColor('text')
                    }}
                >
                    {localeString('views.Settings.SignMessage.onChainAddress')}
                </Text>
            </React.Fragment>
        );

        const buttons = [
            { element: lightningButton },
            { element: onchainButton }
        ];
        const buttonElements = buttons.map((btn) => btn.element());

        return (
            <View style={styles.form}>
                <Text style={{ color: themeColor('secondaryText') }}>
                    {localeString('views.Settings.SignMessage.signingMethod')}
                </Text>
                <ButtonGroup
                    onPress={this.updateSigningMethod}
                    selectedIndex={signingMethodIndex}
                    buttons={buttonElements}
                    selectedButtonStyle={{
                        backgroundColor: themeColor('highlight'),
                        borderRadius: 12
                    }}
                    containerStyle={{
                        backgroundColor: themeColor('secondary'),
                        borderRadius: 12,
                        borderColor: themeColor('secondary'),
                        marginTop: 10,
                        marginBottom: 10
                    }}
                    innerBorderStyle={{
                        color: themeColor('secondary')
                    }}
                />

                {signingMethodIndex === 1 && (
                    <View style={{ marginTop: 10 }}>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                marginBottom: 5
                            }}
                        >
                            {localeString(
                                'views.Settings.SignMessage.selectAddressSigning'
                            )}
                        </Text>

                        {addresses.length === 0 && (
                            <View
                                style={[
                                    styles.infoBox,
                                    {
                                        backgroundColor:
                                            themeColor('secondary'),
                                        borderColor: themeColor('secondary')
                                    }
                                ]}
                            >
                                <Text style={{ color: themeColor('text') }}>
                                    {localeString(
                                        'views.Settings.SignMessage.loadingAddresses'
                                    )}
                                </Text>
                            </View>
                        )}

                        {addresses.length > 0 ? (
                            <View>
                                <DropdownSetting
                                    selectedValue={
                                        this.state.signingAddressLocal ||
                                        selectedAddress
                                    }
                                    values={addresses.map((addr: Address) => ({
                                        key: addr.accountName
                                            ? `${addr.address.substring(
                                                  0,
                                                  5
                                              )}...${addr.address.substring(
                                                  addr.address.length - 5
                                              )} (${addr.type}) - ${
                                                  addr.accountName
                                              }`
                                            : `${addr.address.substring(
                                                  0,
                                                  5
                                              )}...${addr.address.substring(
                                                  addr.address.length - 5
                                              )} (${addr.type})`,
                                        value: addr.address
                                    }))}
                                    onValueChange={(value: string) => {
                                        console.log(
                                            'Selected address changed to:',
                                            value
                                        );
                                        this.setState({
                                            signingAddressLocal: value
                                        });
                                        // Explicitly call store method and make sure it updates
                                        MessageSignStore.setSelectedAddress(
                                            value
                                        );
                                        // Adding console log to debug
                                        console.log(
                                            'After setting store address, selectedAddress is now:',
                                            MessageSignStore.selectedAddress
                                        );
                                    }}
                                />

                                <View
                                    style={[
                                        styles.addressInfoBox,
                                        {
                                            backgroundColor:
                                                themeColor('secondary'),
                                            borderColor: themeColor('secondary')
                                        }
                                    ]}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontSize: 12
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.SignMessage.fullAddress'
                                        )}
                                    </Text>
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginTop: 3
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                fontSize: 12,
                                                flex: 1
                                            }}
                                        >
                                            {this.state.signingAddressLocal ||
                                                selectedAddress}
                                        </Text>
                                        <CopyButton
                                            copyValue={
                                                this.state
                                                    .signingAddressLocal ||
                                                selectedAddress
                                            }
                                            iconOnly={true}
                                            iconSize={16}
                                        />
                                    </View>

                                    {/* Show account info if available */}
                                    {addresses.find(
                                        (addr: Address) =>
                                            addr.address ===
                                            (this.state.signingAddressLocal ||
                                                selectedAddress)
                                    )?.accountName && (
                                        <>
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontSize: 12,
                                                    marginTop: 10
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.SignMessage.account'
                                                )}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: themeColor('text'),
                                                    fontSize: 12,
                                                    marginTop: 3
                                                }}
                                            >
                                                {addresses.find(
                                                    (addr: Address) =>
                                                        addr.address ===
                                                        (this.state
                                                            .signingAddressLocal ||
                                                            selectedAddress)
                                                )?.accountName || 'Default'}
                                            </Text>
                                        </>
                                    )}

                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontSize: 12,
                                            marginTop: 10
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.SignMessage.addressType'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontSize: 12,
                                            marginTop: 3
                                        }}
                                    >
                                        {addresses.find(
                                            (addr: Address) =>
                                                addr.address ===
                                                (this.state
                                                    .signingAddressLocal ||
                                                    selectedAddress)
                                        )?.type || 'Unknown'}
                                    </Text>
                                </View>
                            </View>
                        ) : (
                            <View
                                style={[
                                    styles.errorBox,
                                    {
                                        backgroundColor:
                                            themeColor('errorBackground'),
                                        borderColor:
                                            themeColor('errorBackground')
                                    }
                                ]}
                            >
                                <Text style={{ color: themeColor('error') }}>
                                    {localeString(
                                        'views.Settings.SignMessage.noAddressesAvailable'
                                    )}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    render() {
        const { navigation, MessageSignStore } = this.props;
        const {
            messageToSign,
            messageToVerify,
            signatureToVerify,
            selectedIndex,
            verifyingAddress,
            signingMode
        } = this.state;
        const { loading, signMessage, pubkey, valid, signature, addresses } =
            MessageSignStore;

        const { supportsAddressMessageSigning } = this.state;
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

        const buttonElements = buttons.map((btn) => btn.element());

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.SignMessage.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
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
                        buttons={buttonElements}
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

                    {selectedIndex === 0 && this.renderSigningMethodSelector()}

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
                                    multiline
                                    style={{
                                        height: 100
                                    }}
                                    locked={loading}
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
                                    onPress={() => {
                                        if (
                                            !messageToSign ||
                                            messageToSign.trim() === ''
                                        ) {
                                            // Don't attempt to sign empty messages
                                            Alert.alert(
                                                localeString(
                                                    'views.Settings.SignMessage.pleaseEnterMessage'
                                                )
                                            );
                                            return;
                                        }
                                        signMessage(messageToSign);
                                    }}
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
                                                color: themeColor('text'),
                                                borderColor:
                                                    themeColor('secondary')
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
                                {supportsAddressMessageSigning ? (
                                    <View style={{ marginBottom: 15 }}>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.SignMessage.signatureType'
                                            )}
                                        </Text>
                                        <ButtonGroup
                                            onPress={(index: number) => {
                                                if (index === 0) {
                                                    MessageSignStore.setSigningMode(
                                                        'lightning'
                                                    );
                                                } else {
                                                    MessageSignStore.setSigningMode(
                                                        'onchain'
                                                    );
                                                }
                                                this.setState({
                                                    signingMode:
                                                        index === 0
                                                            ? 'lightning'
                                                            : 'onchain'
                                                });
                                            }}
                                            selectedIndex={
                                                signingMode === 'lightning'
                                                    ? 0
                                                    : 1
                                            }
                                            buttons={[
                                                localeString(
                                                    'views.Settings.SignMessage.lightningNode'
                                                ),
                                                localeString(
                                                    'views.Settings.SignMessage.onChainAddress'
                                                )
                                            ]}
                                            selectedButtonStyle={{
                                                backgroundColor:
                                                    themeColor('highlight'),
                                                borderRadius: 12
                                            }}
                                            containerStyle={{
                                                backgroundColor:
                                                    themeColor('secondary'),
                                                borderRadius: 12,
                                                borderColor:
                                                    themeColor('secondary'),
                                                marginTop: 10,
                                                marginBottom: 10
                                            }}
                                            innerBorderStyle={{
                                                color: themeColor('secondary')
                                            }}
                                            textStyle={{
                                                color: themeColor('text')
                                            }}
                                            selectedTextStyle={{
                                                color: themeColor('secondary')
                                            }}
                                        />
                                    </View>
                                ) : null}

                                {supportsAddressMessageSigning &&
                                    signingMode === 'onchain' && (
                                        <View style={styles.form}>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.SignMessage.addressRequired'
                                                )}
                                            </Text>
                                            {addresses.length === 0 && (
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'text'
                                                        )
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.Settings.SignMessage.loadingAddresses'
                                                    )}
                                                </Text>
                                            )}
                                            {addresses.length > 0 ? (
                                                <View>
                                                    <DropdownSetting
                                                        selectedValue={
                                                            verifyingAddress
                                                        }
                                                        values={addresses.map(
                                                            (
                                                                addr: Address
                                                            ) => ({
                                                                key: addr.accountName
                                                                    ? `${addr.address.substring(
                                                                          0,
                                                                          5
                                                                      )}...${addr.address.substring(
                                                                          addr
                                                                              .address
                                                                              .length -
                                                                              5
                                                                      )} (${
                                                                          addr.type
                                                                      }) - ${
                                                                          addr.accountName
                                                                      }`
                                                                    : `${addr.address.substring(
                                                                          0,
                                                                          5
                                                                      )}...${addr.address.substring(
                                                                          addr
                                                                              .address
                                                                              .length -
                                                                              5
                                                                      )} (${
                                                                          addr.type
                                                                      })`,
                                                                value: addr.address
                                                            })
                                                        )}
                                                        onValueChange={(
                                                            value: string
                                                        ) =>
                                                            this.setState({
                                                                verifyingAddress:
                                                                    value
                                                            })
                                                        }
                                                    />

                                                    <View
                                                        style={[
                                                            styles.addressInfoBox,
                                                            {
                                                                backgroundColor:
                                                                    themeColor(
                                                                        'secondary'
                                                                    ),
                                                                borderColor:
                                                                    themeColor(
                                                                        'secondary'
                                                                    )
                                                            }
                                                        ]}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                ),
                                                                fontSize: 12
                                                            }}
                                                        >
                                                            {localeString(
                                                                'views.Settings.SignMessage.fullAddress'
                                                            )}
                                                        </Text>
                                                        <View
                                                            style={{
                                                                flexDirection:
                                                                    'row',
                                                                alignItems:
                                                                    'center',
                                                                marginTop: 3
                                                            }}
                                                        >
                                                            <Text
                                                                style={{
                                                                    color: themeColor(
                                                                        'text'
                                                                    ),
                                                                    fontSize: 12,
                                                                    flex: 1
                                                                }}
                                                            >
                                                                {
                                                                    verifyingAddress
                                                                }
                                                            </Text>
                                                            <CopyButton
                                                                copyValue={
                                                                    verifyingAddress
                                                                }
                                                                iconOnly={true}
                                                                iconSize={16}
                                                            />
                                                        </View>

                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'secondaryText'
                                                                ),
                                                                fontSize: 12,
                                                                marginTop: 10
                                                            }}
                                                        >
                                                            {localeString(
                                                                'views.Settings.SignMessage.addressType'
                                                            )}
                                                        </Text>
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'text'
                                                                ),
                                                                fontSize: 12,
                                                                marginTop: 3
                                                            }}
                                                        >
                                                            {addresses.find(
                                                                (
                                                                    addr: Address
                                                                ) =>
                                                                    addr.address ===
                                                                    verifyingAddress
                                                            )?.type ||
                                                                'Unknown'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ) : (
                                                <View
                                                    style={[
                                                        styles.errorBox,
                                                        {
                                                            backgroundColor:
                                                                themeColor(
                                                                    'errorBackground'
                                                                ),
                                                            borderColor:
                                                                themeColor(
                                                                    'errorBackground'
                                                                )
                                                        }
                                                    ]}
                                                >
                                                    <Text
                                                        style={{
                                                            color: themeColor(
                                                                'error'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'views.Settings.SignMessage.noAddressesAvailable'
                                                        )}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                            </View>

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
                                    style={{
                                        height: 100
                                    }}
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
                                    multiline
                                    style={{
                                        height: 100
                                    }}
                                    locked={loading}
                                />
                            </View>

                            {valid !== null ? (
                                <View style={styles.result}>
                                    {valid ? (
                                        <SuccessMessage
                                            message={localeString(
                                                'views.Settings.SignMessage.success'
                                            )}
                                        />
                                    ) : (
                                        <ErrorMessage
                                            message={localeString(
                                                'views.Settings.SignMessage.error'
                                            )}
                                        />
                                    )}
                                </View>
                            ) : null}

                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.Settings.signMessage.buttonVerify'
                                    )}
                                    icon={{
                                        name: 'check'
                                    }}
                                    onPress={this.verifyMessage}
                                />
                            </View>

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
                        </View>
                    )}

                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.Settings.SignMessage.clear'
                            )}
                            icon={{
                                name: 'clear'
                            }}
                            onPress={() => this.reset()}
                            tertiary
                        />
                    </View>
                </ScrollView>
            </Screen>
        );
    }

    verifyMessage = async () => {
        const { MessageSignStore } = this.props;
        const {
            messageToVerify,
            signatureToVerify,
            verifyingAddress,
            signingMode
        } = this.state;

        // Validation
        if (!messageToVerify || messageToVerify.trim() === '') {
            Alert.alert(
                localeString(
                    'views.Settings.SignMessage.pleaseEnterMessageVerify'
                )
            );
            return;
        }

        if (!signatureToVerify || signatureToVerify.trim() === '') {
            Alert.alert(
                localeString('views.Settings.SignMessage.pleaseEnterSignature')
            );
            return;
        }

        const { supportsAddressMessageSigning } = this.state;

        if (
            supportsAddressMessageSigning &&
            signingMode === 'onchain' &&
            (!verifyingAddress || verifyingAddress.trim() === '')
        ) {
            Alert.alert(
                localeString('views.Settings.SignMessage.pleaseSelectAddress')
            );
            console.log(
                '[SignVerifyMessage] Verification aborted: no address provided for on-chain verification'
            );
            return;
        }

        const verifyRequest = {
            msg: messageToVerify,
            signature: signatureToVerify,
            addr:
                supportsAddressMessageSigning && signingMode === 'onchain'
                    ? verifyingAddress
                    : undefined
        };

        MessageSignStore.verifyMessage(verifyRequest);
    };
}

const styles = StyleSheet.create({
    content: {
        padding: 20
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    form: {
        paddingTop: 20
    },
    textInput: {
        marginTop: 5,
        borderWidth: 1,
        borderRadius: 6,
        padding: 10,
        minHeight: 100,
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        paddingTop: 20,
        paddingBottom: 10
    },
    result: {
        paddingTop: 20
    },
    infoBox: {
        padding: 10,
        borderRadius: 6,
        borderWidth: 1
    },
    addressInfoBox: {
        padding: 10,
        borderRadius: 6,
        borderWidth: 1,
        marginTop: 10
    },
    errorBox: {
        padding: 10,
        borderRadius: 6,
        borderWidth: 1,
        marginTop: 10
    }
});
