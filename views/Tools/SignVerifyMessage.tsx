import * as React from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Alert,
    TouchableOpacity
} from 'react-native';
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

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';
import addressUtils from '../../utils/AddressUtils';

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
    selectedAddress: string;
    signingMode: string;
    supportsAddressMessageSigning: boolean;
    supportsAddressMessageVerification: boolean;
    loading: boolean;
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
        selectedAddress: '',
        signingMode: 'lightning',
        supportsAddressMessageSigning: false,
        supportsAddressMessageVerification: false,
        loading: false
    };

    componentDidMount = () => {
        const { MessageSignStore, navigation, route } = this.props;
        MessageSignStore.reset();

        const canSignWithAddress = BackendUtils.supportsAddressMessageSigning();
        const canVerifyWithAddress =
            BackendUtils.supportsAddressMessageVerification();

        this.setState({
            supportsAddressMessageSigning: canSignWithAddress,
            supportsAddressMessageVerification: canVerifyWithAddress
        });

        // Load addresses right away and also when the screen comes into focus
        if (canSignWithAddress) {
            MessageSignStore.loadAddresses();

            // Also reload addresses whenever the screen comes into focus
            this.navigationFocusListener = navigation.addListener(
                'focus',
                () => {
                    MessageSignStore.loadAddresses();
                    this.checkForAddressSelection();
                }
            );
        }

        this.handleRouteParams(route?.params || {});
    };

    componentWillUnmount() {
        if (this.navigationFocusListener) {
            this.navigationFocusListener();
        }
    }

    checkForAddressSelection = () => {
        const { route } = this.props;
        const params = route?.params || {};

        this.handleRouteParams(params);
    };

    handleRouteParams = (params: any) => {
        const { MessageSignStore } = this.props;

        if (params.selectedIndex !== undefined) {
            this.setState({ selectedIndex: params.selectedIndex });
        }

        if (params.message) {
            this.setState({
                messageToVerify: params.message,
                selectedIndex: 1
            });
        }

        if (params.address) {
            this.setState({
                selectedAddress: params.address
            });
        }

        if (params.preserveMode === 'onchain') {
            this.setState({ signingMode: 'onchain' });
            MessageSignStore.setSigningMode('onchain');
        }

        if (params.selectedAddress) {
            const selectedAddress = params.selectedAddress;
            const mode = params.mode;

            if (mode === 'sign') {
                this.setState({
                    selectedAddress,
                    signingMethodIndex: 1
                });
                MessageSignStore.setSigningMode('onchain');
                MessageSignStore.setSelectedAddress(selectedAddress);
            } else if (mode === 'verify') {
                this.setState({
                    selectedAddress,
                    signingMode: 'onchain'
                });
                MessageSignStore.setSigningMode('onchain');
            }
        }

        if (params?.signingMode) {
            this.setState({ signingMode: params.signingMode });
            MessageSignStore.setSigningMode(params.signingMode);
        }

        if (params?.messageToSign !== undefined) {
            this.setState({ messageToSign: params.messageToSign });
        }

        if (params?.messageToVerify !== undefined) {
            this.setState({ messageToVerify: params.messageToVerify });
        }

        if (params?.signatureToVerify !== undefined) {
            this.setState({ signatureToVerify: params.signatureToVerify });
        }

        if (
            params?.selectedAddress ||
            params?.selectedIndex !== undefined ||
            params?.signingMode ||
            params?.preserveMode ||
            params?.messageToSign !== undefined ||
            params?.messageToVerify !== undefined ||
            params?.signatureToVerify !== undefined
        ) {
            this.props.navigation.setParams({
                selectedAddress: undefined,
                mode: undefined,
                selectedIndex: undefined,
                signingMode: undefined,
                preserveMode: undefined,
                messageToSign: undefined,
                messageToVerify: undefined,
                signatureToVerify: undefined,
                timestamp: undefined
            });
        }
    };

    componentDidUpdate(prevProps: SignVerifyMessageProps) {
        const { addresses, selectedAddress } = this.props.MessageSignStore;

        if (
            addresses &&
            addresses.length > 0 &&
            (!prevProps.MessageSignStore.addresses ||
                prevProps.MessageSignStore.addresses.length === 0)
        ) {
            if (!this.state.selectedAddress) {
                this.setState({ selectedAddress: addresses[0].address });
            }
        }

        if (
            selectedAddress !== prevProps.MessageSignStore.selectedAddress &&
            !this.state.selectedAddress
        ) {
            this.setState({ selectedAddress });
        }
    }

    reset = () => {
        const { MessageSignStore } = this.props;
        const { signingMode } = this.state;

        // Clear form fields but preserve the signing mode
        this.setState({
            messageToSign: '',
            messageToVerify: '',
            signatureToVerify: '',
            selectedAddress: ''
        });

        // Reset the store but preserve the signing mode and address for onchain
        MessageSignStore.reset();
        MessageSignStore.setSigningMode(signingMode as 'lightning' | 'onchain');
    };

    updateIndex = (selectedIndex: number) => {
        const { signingMode } = this.state;
        const { MessageSignStore } = this.props;

        this.reset();
        this.setState({
            selectedIndex
        });

        MessageSignStore.reset();
        MessageSignStore.setSigningMode(signingMode as 'lightning' | 'onchain');
        MessageSignStore.setSelectedAddress('');
    };

    updateSigningMethod = (signingMethodIndex: number) => {
        const { MessageSignStore } = this.props;
        const signingMode = signingMethodIndex === 0 ? 'lightning' : 'onchain';

        // Clear message field and set the appropriate signing mode
        this.reset();
        this.setState({
            signingMethodIndex,
            signingMode
        });

        // Update the store with the new signing mode
        MessageSignStore.setSigningMode(signingMode);

        // Clear the selected address in the store only when switching to lightning mode
        MessageSignStore.setSelectedAddress('');
    };

    setSelectedAddress = (mode: 'sign' | 'verify', address: string) => {
        const { MessageSignStore } = this.props;

        this.setState({
            selectedAddress: address
        });

        MessageSignStore.setSigningMode('onchain');
        MessageSignStore.setSelectedAddress(address);

        if (mode === 'sign') {
            this.setState({
                signingMethodIndex: 1
            });
        }
    };

    navigateToAddressPicker = (mode: 'sign' | 'verify') => {
        const { navigation } = this.props;
        const { selectedAddress } = this.state;

        // callback function to handle address selection
        const handleAddressSelected = (address: string) => {
            this.setSelectedAddress(mode, address);
        };

        navigation.navigate('OnChainAddresses', {
            selectionMode: true,
            selectedAddress,
            onAddressSelected: handleAddressSelected,
            headerTitle: localeString(
                'views.Settings.SignMessage.selectAddress'
            )
        });
    };

    clearSelectedAddress = () => {
        const { MessageSignStore } = this.props;

        this.setState({ selectedAddress: '' });
        MessageSignStore.setSelectedAddress('');
    };

    renderAddressSelector = (mode: 'sign' | 'verify') => {
        const { MessageSignStore } = this.props;
        const { addresses } = MessageSignStore;
        const { selectedAddress, loading } = this.state;

        if (mode === 'verify') {
            return (
                <View style={styles.addressSelector}>
                    <Text
                        style={{
                            ...styles.text,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString(
                            'views.Settings.SignMessage.selectAddressVerification'
                        )}
                    </Text>
                    <TextInput
                        value={selectedAddress}
                        onChangeText={(text: string) => {
                            this.setState({ selectedAddress: text });
                            MessageSignStore.setSelectedAddress(text);

                            if (MessageSignStore.error) {
                                MessageSignStore.reset();
                                MessageSignStore.setSigningMode(
                                    this.state.signingMode as
                                        | 'lightning'
                                        | 'onchain'
                                );
                                MessageSignStore.setSelectedAddress(text);
                            }
                        }}
                        locked={loading}
                    />
                </View>
            );
        }

        // For signing, use the address picker since you can only sign with your own addresses
        const currentAddressDetails = addresses.find(
            (addr) => addressUtils.extractAddressValue(addr) === selectedAddress
        );
        const displayLabel = selectedAddress;

        return (
            <View style={styles.addressSelector}>
                <Text
                    style={{
                        ...styles.text,
                        color: themeColor('secondaryText')
                    }}
                >
                    {localeString(
                        'views.Settings.SignMessage.selectAddressSigning'
                    )}
                </Text>

                <TouchableOpacity
                    style={[
                        styles.addressButton,
                        {
                            backgroundColor: themeColor('secondary'),
                            ...(selectedAddress
                                ? {
                                      borderColor: themeColor('highlight'),
                                      borderWidth: 1
                                  }
                                : {
                                      borderColor: themeColor('secondaryText'),
                                      borderWidth: 1,
                                      borderStyle: 'dashed'
                                  })
                        }
                    ]}
                    onPress={() => this.navigateToAddressPicker(mode)}
                >
                    {!selectedAddress && (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    textAlign: 'center',
                                    marginRight: 5
                                }}
                            >
                                {localeString(
                                    'views.Settings.SignMessage.tapToSelectAddress'
                                )}
                            </Text>
                        </View>
                    )}

                    {selectedAddress && (
                        <Text
                            style={{
                                color: themeColor('highlight'),
                                textAlign: 'center'
                            }}
                        >
                            {displayLabel}
                        </Text>
                    )}
                </TouchableOpacity>

                {selectedAddress && (
                    <View
                        style={[
                            styles.addressInfoBox,
                            {
                                backgroundColor: themeColor('secondary'),
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
                            :
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
                                {selectedAddress}
                            </Text>
                            <CopyButton
                                copyValue={selectedAddress}
                                iconOnly={true}
                                iconSize={16}
                            />
                        </View>

                        {/* Show account info if available */}
                        {currentAddressDetails?.accountName && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontSize: 12,
                                        marginTop: 10
                                    }}
                                >
                                    {localeString('general.accountName')}:
                                </Text>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 12,
                                        marginTop: 3
                                    }}
                                >
                                    {currentAddressDetails.accountName}
                                </Text>
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    };

    renderSigningMethodSelector = () => {
        const { signingMethodIndex } = this.state;
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
                    {localeString('general.defaultNodeNickname')}
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
                    {localeString('general.onchain')}
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
                        marginBottom: 10
                    }}
                    innerBorderStyle={{
                        color: themeColor('secondary')
                    }}
                />
            </View>
        );
    };

    handleTextInputChange = (
        field: keyof SignVerifyMessageState,
        value: string
    ) => {
        this.setState({ [field]: value } as any);

        if (this.props.MessageSignStore.error) {
            this.props.MessageSignStore.reset();
            this.props.MessageSignStore.setSigningMode(
                this.state.signingMode as 'lightning' | 'onchain'
            );
        }
    };

    renderErrorMessage = (customCondition: boolean = true) => {
        const { MessageSignStore } = this.props;
        const { error, errorMessage } = MessageSignStore;

        if (error && customCondition) {
            return (
                <View style={styles.result}>
                    <ErrorMessage
                        message={
                            errorMessage ||
                            localeString('views.Settings.SignMessage.error')
                        }
                    />
                </View>
            );
        }

        return null;
    };

    renderVerificationResult = () => {
        const { MessageSignStore } = this.props;
        const { valid, error, errorMessage } = MessageSignStore;

        if (valid !== null || error) {
            return (
                <View style={styles.result}>
                    {valid ? (
                        <SuccessMessage
                            message={localeString(
                                'views.Settings.SignMessage.success'
                            )}
                        />
                    ) : (
                        <ErrorMessage
                            message={
                                error && errorMessage
                                    ? errorMessage
                                    : localeString(
                                          'views.Settings.SignMessage.error'
                                      )
                            }
                        />
                    )}
                </View>
            );
        }

        return null;
    };

    validateSigningInput = () => {
        const { messageToSign } = this.state;

        if (
            this.state.signingMode === 'onchain' &&
            !this.state.selectedAddress
        ) {
            Alert.alert(
                localeString('views.Settings.SignMessage.pleaseSelectAddress')
            );
            return false;
        }

        if (!messageToSign || messageToSign.trim() === '') {
            Alert.alert(
                localeString('views.Settings.SignMessage.pleaseEnterMessage')
            );
            return false;
        }

        return true;
    };

    validateVerificationInput = () => {
        const {
            messageToVerify,
            signatureToVerify,
            selectedAddress,
            signingMode
        } = this.state;
        const { supportsAddressMessageSigning } = this.state;

        if (!messageToVerify || messageToVerify.trim() === '') {
            Alert.alert(
                localeString(
                    'views.Settings.SignMessage.pleaseEnterMessageVerify'
                )
            );
            return false;
        }

        if (!signatureToVerify || signatureToVerify.trim() === '') {
            Alert.alert(
                localeString('views.Settings.SignMessage.pleaseEnterSignature')
            );
            return false;
        }

        if (
            supportsAddressMessageSigning &&
            signingMode === 'onchain' &&
            (!selectedAddress || selectedAddress.trim() === '')
        ) {
            Alert.alert(
                localeString('views.Settings.SignMessage.pleaseSelectAddress')
            );
            return false;
        }

        return true;
    };

    render() {
        const { navigation, MessageSignStore } = this.props;
        const {
            messageToSign,
            messageToVerify,
            signatureToVerify,
            selectedIndex,
            signingMode,
            loading
        } = this.state;
        const { signMessage, pubkey, valid, signature } = MessageSignStore;

        const {
            supportsAddressMessageSigning,
            supportsAddressMessageVerification
        } = this.state;

        const isVerifyingWithOnchain =
            selectedIndex === 1 && signingMode === 'onchain';
        const disableVerificationInputs =
            isVerifyingWithOnchain && !supportsAddressMessageVerification;

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
                    rightComponent={
                        loading ? (
                            <View
                                style={{
                                    width: 24,
                                    height: 24,
                                    marginRight: 10
                                }}
                            >
                                <LoadingIndicator size={24} />
                            </View>
                        ) : undefined
                    }
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

                    {supportsAddressMessageSigning && (
                        <Text
                            style={{
                                ...styles.text,
                                color: themeColor('secondaryText'),
                                paddingTop: 20
                            }}
                        >
                            {selectedIndex === 0
                                ? localeString(
                                      'views.Settings.SignMessage.signingMethod'
                                  )
                                : localeString(
                                      'views.Settings.SignMessage.signatureType'
                                  )}
                        </Text>
                    )}
                    <View style={styles.form}>
                        {supportsAddressMessageSigning ? (
                            <View style={{ marginBottom: 15 }}>
                                {this.renderSigningMethodSelector()}
                            </View>
                        ) : null}

                        {supportsAddressMessageSigning &&
                            signingMode === 'onchain' &&
                            (selectedIndex === 1 &&
                            supportsAddressMessageVerification
                                ? this.renderAddressSelector('verify')
                                : selectedIndex === 0
                                ? this.renderAddressSelector('sign')
                                : null)}
                    </View>

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
                                    onChangeText={(text: string) => {
                                        this.handleTextInputChange(
                                            'messageToSign',
                                            text
                                        );
                                    }}
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
                                        if (this.validateSigningInput()) {
                                            if (
                                                this.state.signingMode ===
                                                'onchain'
                                            ) {
                                                MessageSignStore.setSelectedAddress(
                                                    this.state.selectedAddress
                                                );
                                            }
                                            signMessage(messageToSign);
                                        }
                                    }}
                                />
                            </View>

                            {this.renderErrorMessage(selectedIndex === 0)}

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
                                                    themeColor('secondary'),
                                                backgroundColor:
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
                            {disableVerificationInputs && (
                                <ErrorMessage
                                    message={localeString(
                                        'views.Settings.SignMessage.addressVerificationNotSupported'
                                    )}
                                />
                            )}

                            <View
                                style={
                                    disableVerificationInputs
                                        ? styles.disabledContainer
                                        : null
                                }
                            >
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
                                        onChangeText={(text: string) => {
                                            this.handleTextInputChange(
                                                'messageToVerify',
                                                text
                                            );
                                        }}
                                        locked={
                                            loading || disableVerificationInputs
                                        }
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
                                        onChangeText={(text: string) => {
                                            this.handleTextInputChange(
                                                'signatureToVerify',
                                                text
                                            );
                                        }}
                                        multiline
                                        style={{
                                            height: 100
                                        }}
                                        locked={
                                            loading || disableVerificationInputs
                                        }
                                    />
                                </View>

                                {this.renderVerificationResult()}

                                <View style={styles.button}>
                                    <Button
                                        title={localeString(
                                            'views.Settings.signMessage.buttonVerify'
                                        )}
                                        icon={{
                                            name: 'check'
                                        }}
                                        onPress={this.verifyMessage}
                                        disabled={disableVerificationInputs}
                                    />
                                </View>
                            </View>

                            {valid && pubkey && (
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

                    <View style={[styles.button, { paddingBottom: 50 }]}>
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
            selectedAddress,
            signingMode
        } = this.state;

        if (!this.validateVerificationInput()) {
            return;
        }

        if (signingMode === 'onchain' && selectedAddress) {
            const canVerifyWithAddress =
                this.state.supportsAddressMessageVerification;

            if (!canVerifyWithAddress) {
                Alert.alert(
                    localeString('views.Settings.SignMessage.error'),
                    localeString(
                        'views.Settings.SignMessage.addressVerificationNotSupported'
                    )
                );
                return;
            }

            MessageSignStore.setSelectedAddress(selectedAddress);
        }

        const verifyRequest = {
            msg: messageToVerify,
            signature: signatureToVerify,
            addr: signingMode === 'onchain' ? selectedAddress : undefined
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
        paddingTop: 5
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
    addressInfoBox: {
        padding: 10,
        borderRadius: 6,
        borderWidth: 1,
        marginTop: 10
    },
    addressSelector: {
        marginBottom: 10,
        marginTop: 6
    },
    addressButton: {
        padding: 10,
        borderRadius: 6,
        marginTop: 10
    },
    disabledContainer: {
        opacity: 0.25
    }
});
