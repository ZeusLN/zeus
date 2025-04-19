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
// import DropdownInput from '../../components/DropdownInput';
import DropdownSetting from '../../components/DropdownSetting';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import backendUtils from '../../utils/BackendUtils';

import MessageSignStore, { SortBy } from '../../stores/MessageSignStore';

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
    sortBy: SortBy;
}

interface Address {
    address: string;
    type: string;
    accountName?: string;
}

// Convert the static styles to a theme-aware function
const getStyles = (theme: any) =>
    StyleSheet.create({
        content: {
            flex: 1,
            paddingHorizontal: 16
        },
        cardContainer: {
            paddingVertical: 16
        },
        sectionCard: {
            backgroundColor: theme.secondary,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2
        },
        formGroup: {
            marginBottom: 16
        },
        formLabel: {
            fontFamily: 'PPNeueMontreal-Book',
            fontSize: 15,
            fontWeight: '600',
            color: theme.secondaryText,
            marginBottom: 8
        },
        textAreaInput: {
            height: 100,
            backgroundColor: theme.background,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            textAlignVertical: 'top',
            fontFamily: 'PPNeueMontreal-Book',
            padding: 12
        },
        buttonContainer: {
            marginTop: 16
        },
        resetButtonContainer: {
            marginTop: 8,
            marginBottom: 16
        },
        resultSection: {
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: theme.border
        },
        signatureContainer: {
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 12,
            maxHeight: 200,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1
        },
        signatureText: {
            color: theme.text,
            fontFamily: 'monospace',
            fontSize: 14
        },
        loadingContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12
        },
        loadingText: {
            color: theme.text,
            marginLeft: 8,
            fontFamily: 'PPNeueMontreal-Book'
        },
        signatureTypeContainer: {
            marginBottom: 16
        },
        infoCard: {
            backgroundColor: theme.background,
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.border
        },
        infoText: {
            color: theme.text,
            fontFamily: 'PPNeueMontreal-Book',
            fontSize: 14
        },
        addressSelectionContainer: {
            marginBottom: 16
        },
        addressInfoCard: {
            backgroundColor: theme.background,
            borderRadius: 12,
            padding: 12,
            marginTop: 12,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1
        },
        addressInfoRow: {
            marginBottom: 12
        },
        addressInfoLabel: {
            color: theme.secondaryText,
            fontSize: 13,
            fontFamily: 'PPNeueMontreal-Book',
            marginBottom: 4
        },
        addressInfoValue: {
            color: theme.text,
            fontSize: 14,
            fontFamily: 'monospace'
        },
        addressValueContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
        },
        addressValue: {
            color: theme.text,
            fontSize: 14,
            fontFamily: 'monospace',
            flex: 1
        },
        errorCard: {
            backgroundColor: theme.errorBackground,
            borderRadius: 12,
            padding: 12,
            marginTop: 12,
            borderWidth: 1,
            borderColor: theme.error
        },
        errorText: {
            color: theme.error,
            fontFamily: 'PPNeueMontreal-Book',
            fontSize: 14
        },
        verificationResult: {
            marginVertical: 16,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            backgroundColor: theme.background
        },
        verificationExplanation: {
            color: theme.secondaryText,
            fontFamily: 'PPNeueMontreal-Book',
            fontSize: 14,
            marginBottom: 12
        },
        pubkeyContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 12
        },
        pubkeyLabel: {
            color: theme.secondaryText,
            fontFamily: 'PPNeueMontreal-Book',
            fontSize: 13,
            marginRight: 8
        },
        pubkeyValue: {
            color: theme.text,
            fontFamily: 'monospace',
            fontSize: 14
        },
        text: {
            fontFamily: 'PPNeueMontreal-Book'
        },
        form: {
            paddingTop: 16
        },
        button: {
            paddingTop: 16,
            paddingBottom: 8
        },
        result: {
            paddingTop: 16
        },
        infoBox: {
            padding: 10,
            borderRadius: 12,
            borderWidth: 1
        },
        addressInfoBox: {
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            marginTop: 12
        },
        errorBox: {
            padding: 10,
            borderRadius: 12,
            borderWidth: 1
        },
        infoSectionCard: {
            padding: 16,
            borderRadius: 16,
            marginBottom: 16,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2
        },
        infoSectionTitle: {
            fontFamily: 'PPNeueMontreal-Book',
            fontSize: 18,
            fontWeight: '600',
            color: theme.text,
            marginBottom: 8
        },
        infoSectionText: {
            fontFamily: 'PPNeueMontreal-Book',
            fontSize: 14,
            color: theme.secondaryText
        },
        sectionSeparator: {
            height: 1,
            backgroundColor: theme.border,
            marginVertical: 16
        },
        featureHint: {
            backgroundColor: theme.background,
            borderRadius: 12,
            padding: 12,
            marginBottom: 16
        },
        featureHintText: {
            color: theme.secondaryText,
            fontFamily: 'PPNeueMontreal-Book',
            fontSize: 14
        }
    });

@inject('SettingsStore', 'MessageSignStore')
@observer
export default class SignVerifyMessage extends React.Component<
    SignVerifyMessageProps,
    SignVerifyMessageState
> {
    navigationFocusListener: any;
    styles: any;

    constructor(props: SignVerifyMessageProps) {
        super(props);
        // Initialize theme-aware styles
        this.styles = getStyles({
            text: themeColor('text'),
            background: themeColor('background'),
            secondary: themeColor('secondary'),
            highlight: themeColor('highlight'),
            border: themeColor('border'),
            shadow: themeColor('shadow'),
            secondaryText: themeColor('secondaryText'),
            error: themeColor('error'),
            errorBackground: themeColor('errorBackground')
        });
    }

    state = {
        messageToSign: '',
        messageToVerify: '',
        signatureToVerify: '',
        selectedIndex: 0,
        signingMethodIndex: 0,
        verifyingAddress: '',
        signingMode: 'lightning',
        signingAddressLocal: '',
        sortBy: SortBy.balanceDescending
    };

    componentDidMount = () => {
        const { MessageSignStore } = this.props;
        MessageSignStore.reset();

        // Load addresses right away and also when the screen comes into focus
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

    getAddressCompatibilityInfo = (addressType: string): string => {
        if (addressType.includes('P2PKH') || addressType.includes('Legacy')) {
            return 'Legacy Address - Compatible';
        } else if (
            addressType.includes('P2WPKH') ||
            addressType.includes('Segwit')
        ) {
            return 'Segwit Address - Compatible';
        } else if (
            addressType.includes('NP2WKH') ||
            addressType.includes('Nested')
        ) {
            return 'Nested Segwit Address - Compatible';
        } else if (
            addressType.includes('P2TR') ||
            addressType.includes('Taproot')
        ) {
            return 'Taproot Address - Compatible';
        } else {
            return 'Unknown Compatibility - May Not Support Signing';
        }
    };

    renderSigningMethodSelector = () => {
        const { signingMethodIndex } = this.state;
        const { MessageSignStore } = this.props;
        const { addresses, selectedAddress } = MessageSignStore;

        const supportsAddressMessageSigning =
            backendUtils.supportsAddressMessageSigning();

        if (!supportsAddressMessageSigning) {
            return (
                <View style={this.styles.form}>
                    <Text style={{ color: themeColor('secondaryText') }}>
                        Only Lightning Node message signing is available in this
                        implementation.
                    </Text>
                </View>
            );
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
                    Lightning Node
                </Text>
            </React.Fragment>
        );

        const onChainButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            signingMethodIndex === 1
                                ? themeColor('background')
                                : themeColor('text')
                    }}
                >
                    On-Chain Address
                </Text>
            </React.Fragment>
        );

        const buttons = [
            { element: lightningButton },
            { element: onChainButton }
        ];
        const buttonElements = buttons.map((btn) => btn.element());

        return (
            <View style={this.styles.form}>
                <Text style={{ color: themeColor('secondaryText') }}>
                    Signing Method
                </Text>
                <ButtonGroup
                    onPress={this.updateSigningMethod}
                    selectedIndex={signingMethodIndex}
                    buttons={buttonElements}
                    selectedButtonStyle={{
                        backgroundColor: themeColor('text'),
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
                        <View style={{ marginBottom: 0 }}>
                            <DropdownSetting
                                title={localeString('general.sorting')}
                                values={[
                                    {
                                        key: localeString(
                                            'views.OnChainAddresses.sortBy.balanceDescending'
                                        ),
                                        value: SortBy.balanceDescending
                                    },
                                    {
                                        key: localeString(
                                            'views.OnChainAddresses.sortBy.balanceAscending'
                                        ),
                                        value: SortBy.balanceAscending
                                    },
                                    {
                                        key: localeString(
                                            'views.OnChainAddresses.sortBy.creationTimeDescending'
                                        ),
                                        value: SortBy.creationTimeDescending
                                    },
                                    {
                                        key: localeString(
                                            'views.OnChainAddresses.sortBy.creationTimeAscending'
                                        ),
                                        value: SortBy.creationTimeAscending
                                    }
                                ]}
                                selectedValue={MessageSignStore.sortBy}
                                onValueChange={(value: SortBy) => {
                                    MessageSignStore.setSortBy(value);
                                    MessageSignStore.loadAddresses(); // Reload with new sorting
                                }}
                            />
                        </View>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                marginBottom: 5
                            }}
                        >
                            Select Address for Signing
                        </Text>

                        {addresses.length === 0 && (
                            <View
                                style={{
                                    ...this.styles.infoBox,
                                    backgroundColor: themeColor('secondary'),
                                    borderColor: themeColor('secondary')
                                }}
                            >
                                <Text style={{ color: themeColor('text') }}>
                                    Loading addresses...
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
                                            ? `${addr.address}`
                                            : `${addr.address}`,
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
                                    style={{
                                        ...this.styles.addressInfoCard,
                                        backgroundColor:
                                            themeColor('secondary'),
                                        borderColor: themeColor('secondary')
                                    }}
                                >
                                    <View style={this.styles.addressInfoRow}>
                                        <Text
                                            style={this.styles.addressInfoLabel}
                                        >
                                            Full Address:
                                        </Text>
                                        <View
                                            style={
                                                this.styles
                                                    .addressValueContainer
                                            }
                                        >
                                            <Text
                                                style={this.styles.addressValue}
                                                numberOfLines={1}
                                                ellipsizeMode="middle"
                                            >
                                                {this.state
                                                    .signingAddressLocal ||
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
                                    </View>

                                    {/* Show account info if available */}
                                    {addresses.find(
                                        (addr: Address) =>
                                            addr.address ===
                                            (this.state.signingAddressLocal ||
                                                selectedAddress)
                                    )?.accountName && (
                                        <View
                                            style={this.styles.addressInfoRow}
                                        >
                                            <Text
                                                style={
                                                    this.styles.addressInfoLabel
                                                }
                                            >
                                                Account:
                                            </Text>
                                            <Text
                                                style={
                                                    this.styles.addressInfoValue
                                                }
                                            >
                                                {addresses.find(
                                                    (addr: Address) =>
                                                        addr.address ===
                                                        (this.state
                                                            .signingAddressLocal ||
                                                            selectedAddress)
                                                )?.accountName || 'Default'}
                                            </Text>
                                        </View>
                                    )}

                                    <View style={this.styles.addressInfoRow}>
                                        <Text
                                            style={this.styles.addressInfoLabel}
                                        >
                                            Address Type:
                                        </Text>
                                        <Text
                                            style={this.styles.addressInfoValue}
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

                                    <View style={this.styles.addressInfoRow}>
                                        <Text
                                            style={this.styles.addressInfoLabel}
                                        >
                                            Signing Compatibility:
                                        </Text>
                                        <Text
                                            style={this.styles.addressInfoValue}
                                        >
                                            {this.getAddressCompatibilityInfo(
                                                addresses.find(
                                                    (addr: Address) =>
                                                        addr.address ===
                                                        (this.state
                                                            .signingAddressLocal ||
                                                            selectedAddress)
                                                )?.type || ''
                                            )}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View
                                style={{
                                    ...this.styles.errorBox,
                                    backgroundColor:
                                        themeColor('errorBackground'),
                                    borderColor: themeColor('errorBackground')
                                }}
                            >
                                <Text style={{ color: themeColor('error') }}>
                                    No on-chain addresses available. Please
                                    ensure your node supports address
                                    management.
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

        // Refresh styles with the current theme
        this.styles = getStyles({
            text: themeColor('text'),
            background: themeColor('background'),
            secondary: themeColor('secondary'),
            highlight: themeColor('highlight'),
            border: themeColor('border'),
            shadow: themeColor('shadow'),
            secondaryText: themeColor('secondaryText'),
            error: themeColor('error'),
            errorBackground: themeColor('errorBackground')
        });

        const supportsAddressMessageSigning =
            backendUtils.supportsAddressMessageSigning();

        const signButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 1
                                ? themeColor('text')
                                : themeColor('background'),
                        fontWeight: '600'
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
                                : themeColor('background'),
                        fontWeight: '600'
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
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 18
                        }
                    }}
                    navigation={navigation}
                />

                <ScrollView
                    style={this.styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={this.styles.cardContainer}>
                        {/* Info section that explains what message signing is */}
                        <View
                            style={[
                                this.styles.sectionCard,
                                this.styles.infoSectionCard
                            ]}
                        >
                            <Text style={this.styles.infoSectionTitle}>
                                {selectedIndex === 0
                                    ? localeString(
                                          'views.Settings.SignMessage.aboutSigning'
                                      )
                                    : localeString(
                                          'views.Settings.SignMessage.aboutVerification'
                                      )}
                            </Text>
                            <Text style={this.styles.infoSectionText}>
                                {selectedIndex === 0
                                    ? 'Sign a message to prove ownership of your Bitcoin address or Lightning node. This creates a cryptographic signature that others can verify.'
                                    : 'Verify a cryptographic signature to confirm a message was signed by a specific Bitcoin address or Lightning node.'}
                            </Text>
                        </View>

                        <ButtonGroup
                            onPress={this.updateIndex}
                            selectedIndex={selectedIndex}
                            buttons={buttonElements}
                            selectedButtonStyle={{
                                backgroundColor: themeColor('highlight'),
                                borderRadius: 12
                            }}
                            containerStyle={{
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 12,
                                borderColor: themeColor('secondary'),
                                marginBottom: 20,
                                height: 45
                            }}
                            innerBorderStyle={{
                                color: themeColor('secondary')
                            }}
                        />

                        {loading && (
                            <View style={this.styles.loadingContainer}>
                                <LoadingIndicator />
                            </View>
                        )}

                        {selectedIndex === 0 && (
                            <View style={this.styles.sectionCard}>
                                {this.renderSigningMethodSelector()}

                                <View style={this.styles.sectionSeparator} />

                                <View style={this.styles.formGroup}>
                                    <Text style={this.styles.formLabel}>
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
                                        style={this.styles.textAreaInput}
                                        locked={loading}
                                    />
                                </View>

                                <View style={this.styles.featureHint}>
                                    <Text style={this.styles.featureHintText}>
                                        Tip: Signing messages can be used to
                                        prove ownership without revealing
                                        private keys or spending funds.
                                    </Text>
                                </View>

                                <View style={this.styles.buttonContainer}>
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
                                                Alert.alert(
                                                    'Please enter a message to sign'
                                                );
                                                return;
                                            }
                                            signMessage(messageToSign);
                                        }}
                                    />
                                </View>

                                {signature && (
                                    <View style={this.styles.resultSection}>
                                        <View style={this.styles.formGroup}>
                                            <Text style={this.styles.formLabel}>
                                                {localeString(
                                                    'views.Settings.SignMessage.generatedSignature'
                                                )}
                                            </Text>
                                            <View
                                                style={
                                                    this.styles
                                                        .signatureContainer
                                                }
                                            >
                                                <Text
                                                    style={
                                                        this.styles
                                                            .signatureText
                                                    }
                                                    selectable
                                                >
                                                    {signature}
                                                </Text>
                                            </View>
                                        </View>

                                        <View
                                            style={this.styles.buttonContainer}
                                        >
                                            <CopyButton
                                                copyValue={signature}
                                                title="Copy Signature"
                                            />
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {selectedIndex === 1 && (
                            <View style={this.styles.sectionCard}>
                                <View style={this.styles.formGroup}>
                                    <Text style={this.styles.formLabel}>
                                        Signature Type
                                    </Text>

                                    {supportsAddressMessageSigning ? (
                                        <View
                                            style={
                                                this.styles
                                                    .signatureTypeContainer
                                            }
                                        >
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
                                                    'Lightning Node',
                                                    'On-chain Address'
                                                ]}
                                                containerStyle={{
                                                    height: 40,
                                                    borderRadius: 10,
                                                    borderColor:
                                                        themeColor('border'),
                                                    backgroundColor:
                                                        'transparent'
                                                }}
                                                selectedButtonStyle={{
                                                    backgroundColor:
                                                        themeColor('highlight')
                                                }}
                                                selectedTextStyle={{
                                                    color: '#FFFFFF',
                                                    fontWeight: 'bold'
                                                }}
                                                textStyle={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    fontSize: 14,
                                                    color: themeColor('text')
                                                }}
                                            />
                                        </View>
                                    ) : (
                                        <View style={this.styles.infoCard}>
                                            <Text style={this.styles.infoText}>
                                                Only Lightning Node verification
                                                is available in this
                                                implementation.
                                            </Text>
                                        </View>
                                    )}

                                    {signingMode === 'onchain' && (
                                        <View
                                            style={
                                                this.styles
                                                    .addressSelectionContainer
                                            }
                                        >
                                            <Text style={this.styles.formLabel}>
                                                Address (required for on-chain
                                                verification)
                                            </Text>

                                            {/* Add sorting dropdown for verify section */}
                                            <View style={{ marginBottom: 10 }}>
                                                <DropdownSetting
                                                    title={localeString(
                                                        'general.sorting'
                                                    )}
                                                    values={[
                                                        {
                                                            key: localeString(
                                                                'views.OnChainAddresses.sortBy.balanceDescending'
                                                            ),
                                                            value: SortBy.balanceDescending
                                                        },
                                                        {
                                                            key: localeString(
                                                                'views.OnChainAddresses.sortBy.balanceAscending'
                                                            ),
                                                            value: SortBy.balanceAscending
                                                        },
                                                        {
                                                            key: localeString(
                                                                'views.OnChainAddresses.sortBy.creationTimeDescending'
                                                            ),
                                                            value: SortBy.creationTimeDescending
                                                        },
                                                        {
                                                            key: localeString(
                                                                'views.OnChainAddresses.sortBy.creationTimeAscending'
                                                            ),
                                                            value: SortBy.creationTimeAscending
                                                        }
                                                    ]}
                                                    selectedValue={
                                                        MessageSignStore.sortBy
                                                    }
                                                    onValueChange={(
                                                        value: SortBy
                                                    ) => {
                                                        MessageSignStore.setSortBy(
                                                            value
                                                        );
                                                        MessageSignStore.loadAddresses(); // Reload with new sorting
                                                    }}
                                                />
                                            </View>

                                            {addresses.length === 0 && (
                                                <View
                                                    style={
                                                        this.styles
                                                            .loadingContainer
                                                    }
                                                >
                                                    <LoadingIndicator
                                                        size={20}
                                                    />
                                                    <Text
                                                        style={
                                                            this.styles
                                                                .loadingText
                                                        }
                                                    >
                                                        Loading addresses...
                                                    </Text>
                                                </View>
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
                                                                    ? `${addr.address}`
                                                                    : `${addr.address}`,
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
                                                        style={
                                                            this.styles
                                                                .addressInfoCard
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                this.styles
                                                                    .addressInfoRow
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    this.styles
                                                                        .addressInfoLabel
                                                                }
                                                            >
                                                                Full Address:
                                                            </Text>
                                                            <View
                                                                style={
                                                                    this.styles
                                                                        .addressValueContainer
                                                                }
                                                            >
                                                                <Text
                                                                    style={
                                                                        this
                                                                            .styles
                                                                            .addressValue
                                                                    }
                                                                    numberOfLines={
                                                                        1
                                                                    }
                                                                    ellipsizeMode="middle"
                                                                >
                                                                    {
                                                                        verifyingAddress
                                                                    }
                                                                </Text>
                                                                <CopyButton
                                                                    copyValue={
                                                                        verifyingAddress
                                                                    }
                                                                    iconOnly={
                                                                        true
                                                                    }
                                                                    iconSize={
                                                                        16
                                                                    }
                                                                />
                                                            </View>
                                                        </View>

                                                        {/* Show account info if available */}
                                                        {addresses.find(
                                                            (addr: Address) =>
                                                                addr.address ===
                                                                verifyingAddress
                                                        )?.accountName && (
                                                            <View
                                                                style={
                                                                    this.styles
                                                                        .addressInfoRow
                                                                }
                                                            >
                                                                <Text
                                                                    style={
                                                                        this
                                                                            .styles
                                                                            .addressInfoLabel
                                                                    }
                                                                >
                                                                    Account:
                                                                </Text>
                                                                <Text
                                                                    style={
                                                                        this
                                                                            .styles
                                                                            .addressInfoValue
                                                                    }
                                                                >
                                                                    {addresses.find(
                                                                        (
                                                                            addr: Address
                                                                        ) =>
                                                                            addr.address ===
                                                                            verifyingAddress
                                                                    )
                                                                        ?.accountName ||
                                                                        'Default'}
                                                                </Text>
                                                            </View>
                                                        )}

                                                        <View
                                                            style={
                                                                this.styles
                                                                    .addressInfoRow
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    this.styles
                                                                        .addressInfoLabel
                                                                }
                                                            >
                                                                Address Type:
                                                            </Text>
                                                            <Text
                                                                style={
                                                                    this.styles
                                                                        .addressInfoValue
                                                                }
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
                                                </View>
                                            ) : (
                                                <View
                                                    style={
                                                        this.styles.errorCard
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            this.styles
                                                                .errorText
                                                        }
                                                    >
                                                        No on-chain addresses
                                                        available. Please ensure
                                                        your node supports
                                                        address management.
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {(signingMode === 'lightning' ||
                                        !supportsAddressMessageSigning) && (
                                        <View style={this.styles.infoCard}>
                                            <Text style={this.styles.infoText}>
                                                Lightning node verification
                                                selected. No address needed.
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <View style={this.styles.formGroup}>
                                    <Text style={this.styles.formLabel}>
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
                                        style={this.styles.textAreaInput}
                                    />
                                </View>

                                <View style={this.styles.formGroup}>
                                    <Text style={this.styles.formLabel}>
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
                                        style={this.styles.textAreaInput}
                                        locked={loading}
                                    />
                                </View>

                                <View style={this.styles.featureHint}>
                                    <Text style={this.styles.featureHintText}>
                                        Tip: Verification confirms a message was
                                        signed by the owner of the{' '}
                                        {signingMode === 'lightning'
                                            ? 'Lightning node'
                                            : 'Bitcoin address'}{' '}
                                        without requiring them to reveal private
                                        keys.
                                    </Text>
                                </View>

                                {valid !== null && (
                                    <View
                                        style={this.styles.verificationResult}
                                    >
                                        {valid ? (
                                            <>
                                                <SuccessMessage
                                                    message={localeString(
                                                        'views.Settings.SignMessage.success'
                                                    )}
                                                />
                                                <Text
                                                    style={
                                                        this.styles
                                                            .verificationExplanation
                                                    }
                                                >
                                                    This signature is valid. It
                                                    confirms that the message
                                                    was signed by the{' '}
                                                    {signingMode === 'lightning'
                                                        ? 'Lightning node'
                                                        : 'Bitcoin address'}{' '}
                                                    owner.
                                                </Text>
                                                {pubkey && (
                                                    <View
                                                        style={
                                                            this.styles
                                                                .pubkeyContainer
                                                        }
                                                    >
                                                        <Text
                                                            style={
                                                                this.styles
                                                                    .pubkeyLabel
                                                            }
                                                        >
                                                            Public Key:
                                                        </Text>
                                                        <Text
                                                            style={
                                                                this.styles
                                                                    .pubkeyValue
                                                            }
                                                            numberOfLines={1}
                                                            ellipsizeMode="middle"
                                                        >
                                                            {pubkey}
                                                        </Text>
                                                    </View>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <ErrorMessage
                                                    message={localeString(
                                                        'views.Settings.SignMessage.error'
                                                    )}
                                                />
                                                <Text
                                                    style={
                                                        this.styles
                                                            .verificationExplanation
                                                    }
                                                >
                                                    This signature is invalid.
                                                    Either the message was
                                                    modified, the signature is
                                                    incorrect, or it was signed
                                                    by a different{' '}
                                                    {signingMode === 'lightning'
                                                        ? 'Lightning node'
                                                        : 'Bitcoin address'}
                                                    .
                                                </Text>
                                            </>
                                        )}
                                    </View>
                                )}

                                <View style={this.styles.buttonContainer}>
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
                                    <View style={this.styles.buttonContainer}>
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

                        <View style={this.styles.resetButtonContainer}>
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
            Alert.alert('Please enter a message to verify');
            return;
        }

        if (!signatureToVerify || signatureToVerify.trim() === '') {
            Alert.alert('Please enter a signature to verify');
            return;
        }

        const supportsAddressMessageSigning =
            backendUtils.supportsAddressMessageSigning();

        if (
            supportsAddressMessageSigning &&
            signingMode === 'onchain' &&
            (!verifyingAddress || verifyingAddress.trim() === '')
        ) {
            Alert.alert(
                'Please select a Bitcoin address for on-chain verification'
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
