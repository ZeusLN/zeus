import * as React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Clipboard from '@react-native-clipboard/clipboard';
import { Chip, Icon } from 'react-native-elements';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Button from '../../components/Button';

import ContactStore from '../../stores/ContactStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import AddressUtils from '../../utils/AddressUtils';
import Scan from '../../assets/images/SVG/Scan.svg';
import ContactIcon from '../../assets/images/SVG/PeersContact.svg';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

interface CashuLockSettingsProps {
    navigation: StackNavigationProp<any, any>;
    ContactStore: ContactStore;
    route: Route<
        'CashuLockSettings',
        {
            onSave?: (pubkey: string, duration: string) => void;
            currentLockPubkey?: string;
            currentDuration?: string;
            destination?: string | null;
            contactName?: string;
            hasCashuPubkey?: boolean;
            fromMintToken?: boolean;
            memo?: string;
            value?: string;
            satAmount?: string | number;
            account?: string;
        }
    >;
}

interface CashuLockSettingsState {
    pubkey: string;
    contactName: string;
    duration: string;
    showCustomDuration: boolean;
    customDurationValue: string;
    customDurationUnit: TimeUnit;
    showUnitDropdown: boolean;
    memo: string;
    value: string;
    satAmount: string | number;
    account: string;
    error: string;
    hasClipboardContent: boolean;
    isPubkeyValid: boolean;
}

type TimeUnit = 'hour' | 'day' | 'week' | 'month' | 'year';

const TIME_UNITS: TimeUnit[] = ['hour', 'day', 'week', 'month', 'year'];

const DURATION_OPTIONS = [
    localeString('cashu.duration.1day'),
    localeString('cashu.duration.1week'),
    localeString('cashu.duration.forever'),
    localeString('cashu.duration.custom')
] as const;

@inject('ContactStore')
@observer
export default class CashuLockSettings extends React.Component<
    CashuLockSettingsProps,
    CashuLockSettingsState
> {
    constructor(props: CashuLockSettingsProps) {
        super(props);
        const { route } = props;
        const {
            currentLockPubkey,
            currentDuration,
            contactName,
            memo,
            value,
            satAmount,
            account
        } = route.params || {};

        this.state = {
            pubkey: currentLockPubkey || '',
            contactName: contactName || '',
            duration: currentDuration || '',
            showCustomDuration: false,
            customDurationValue: '',
            customDurationUnit: 'day' as TimeUnit,
            showUnitDropdown: false,
            memo: memo || '',
            value: value || '',
            satAmount: satAmount || '',
            account: account || 'default',
            error: '',
            hasClipboardContent: false,
            isPubkeyValid: currentLockPubkey
                ? AddressUtils.isValidLightningPubKey(currentLockPubkey)
                : true
        };
        this.handleContactSelection = this.handleContactSelection.bind(this);
    }

    componentDidMount() {
        this.props.navigation.addListener('focus', this.handleFocus);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener('focus', this.handleFocus);
    }

    handleFocus = () => {
        const { route } = this.props;
        const { params } = route;

        if (params.hasCashuPubkey === false) {
            this.setState({
                error: localeString('cashu.contactNoCashuPubkey')
            });
        } else if (params?.destination) {
            this.setState({
                contactName: params.contactName || '',
                pubkey: params.destination,
                error: ''
            });
        }
        this.props.navigation.setParams({
            destination: undefined,
            contactName: undefined,
            hasCashuPubkey: undefined
        });
    };

    handleContactSelection(pubkey: string) {
        this.setState({
            pubkey,
            error: ''
        });
    }

    validatePubkey = (pubkey: string) => {
        if (!pubkey) {
            return localeString('cashu.pubkeyRequired');
        }
        if (!AddressUtils.isValidLightningPubKey(pubkey)) {
            return localeString('cashu.invalidCashuPubkey');
        }
        return '';
    };

    validateCustomDurationValue = (value: string) => {
        if (!value.trim()) {
            return localeString('cashu.durationRequired');
        }

        const numValue = Number(value);
        if (isNaN(numValue) || numValue <= 0 || !Number.isInteger(numValue)) {
            return localeString('cashu.invalidDurationNumber');
        }

        if (numValue > 999) {
            return localeString('cashu.durationTooLong');
        }

        return '';
    };

    validateForm = (): string => {
        const { pubkey, duration, showCustomDuration, customDurationValue } =
            this.state;

        if (!pubkey) {
            return localeString('cashu.pubkeyRequired');
        }
        if (!AddressUtils.isValidLightningPubKey(pubkey)) {
            return localeString('cashu.invalidCashuPubkey');
        }
        if (showCustomDuration) {
            return this.validateCustomDurationValue(customDurationValue);
        }
        if (!duration) {
            return localeString('cashu.durationRequired');
        }
        return '';
    };

    handlePubkeyChange = (text: string) => {
        const cleanedText = text.trim();
        const validationError = this.validatePubkey(cleanedText);
        const isValid = !validationError;

        this.setState({
            pubkey: cleanedText,
            error: validationError,
            isPubkeyValid: isValid
        });

        // Check clipboard content when input is empty
        if (!cleanedText) {
            this.checkClipboardContent();
        }
    };

    handleCustomDurationValueChange = (text: string) => {
        const numericText = text.replace(/[^0-9]/g, '');
        const numValue = parseInt(numericText, 10);

        if (numValue > 999) {
            this.setState({
                error: localeString('cashu.durationTooLong')
            });
            return;
        }

        const error = numericText
            ? this.validateCustomDurationValue(numericText)
            : '';

        this.setState({
            customDurationValue: numericText,
            error
        });
    };

    getCustomDurationString = () => {
        const { customDurationValue, customDurationUnit } = this.state;

        if (!customDurationValue) return '';

        const value = parseInt(customDurationValue, 10);
        const unitString = localeString(`cashu.timeUnit.${customDurationUnit}`);
        return `${value} ${value === 1 ? unitString : unitString + 's'}`;
    };

    handleSave = () => {
        const { navigation } = this.props;
        const {
            pubkey,
            duration,
            showCustomDuration,
            memo,
            value,
            satAmount,
            account,
            contactName
        } = this.state;

        const error = this.validateForm();
        if (error) {
            this.setState({ error });
            return;
        }

        const finalDuration = showCustomDuration
            ? this.getCustomDurationString()
            : duration;

        navigation.navigate('MintToken', {
            pubkey,
            duration: finalDuration,
            fromLockSettings: true,
            memo,
            value,
            satAmount,
            account,
            contactName
        });
    };

    checkClipboardContent = async () => {
        try {
            const text = await Clipboard.getString();
            this.setState({ hasClipboardContent: !!text });
        } catch (error) {
            this.setState({ hasClipboardContent: false });
        }
    };

    handlePaste = async () => {
        try {
            const text = await Clipboard.getString();
            const cleanedText = text.trim();
            const validationError = this.validatePubkey(cleanedText);

            if (!validationError) {
                this.setState({
                    pubkey: cleanedText,
                    error: '',
                    hasClipboardContent: false,
                    isPubkeyValid: true
                });
            } else {
                if (cleanedText && !this.validatePubkey(cleanedText)) {
                    this.setState({
                        pubkey: cleanedText,
                        error: '',
                        hasClipboardContent: false,
                        isPubkeyValid: true
                    });
                } else {
                    this.setState({
                        error: validationError,
                        isPubkeyValid: false
                    });
                }
            }
        } catch (error) {
            this.setState({
                error: localeString('general.clipboardError'),
                hasClipboardContent: false,
                isPubkeyValid: false
            });
        }
    };

    handleQRScanResult = (scannedPubkey: string) => {
        const cleanedPubkey = scannedPubkey.trim();
        const validationError = this.validatePubkey(cleanedPubkey);
        if (!validationError) {
            this.setState({
                pubkey: cleanedPubkey,
                error: '',
                isPubkeyValid: true
            });
        } else {
            if (cleanedPubkey && !this.validatePubkey(cleanedPubkey)) {
                this.setState({
                    pubkey: cleanedPubkey,
                    error: '',
                    isPubkeyValid: true
                });
            } else {
                this.setState({
                    error: validationError,
                    isPubkeyValid: false
                });
            }
        }
    };

    getDynamicStyles = () => {
        return {
            cancelButton: {
                ...styles.cancelButton,
                backgroundColor: themeColor('secondary')
            },
            cancelButtonText: {
                ...styles.cancelButtonText,
                color: themeColor('text')
            },
            lockButton: {
                ...styles.lockButton,
                backgroundColor: themeColor('text')
            },
            lockButtonDisabled: {
                ...styles.lockButton,
                backgroundColor: themeColor('secondary')
            },
            lockButtonText: {
                ...styles.lockButtonText,
                color: themeColor('secondary')
            }
        };
    };

    isFormValid = () => {
        const {
            pubkey,
            duration,
            showCustomDuration,
            customDurationValue,
            error
        } = this.state;

        return (
            pubkey &&
            AddressUtils.isValidLightningPubKey(pubkey) &&
            !error &&
            ((duration && !showCustomDuration) ||
                (showCustomDuration && customDurationValue && !error))
        );
    };

    render() {
        const { navigation } = this.props;
        const {
            pubkey,
            duration,
            showCustomDuration,
            customDurationValue,
            customDurationUnit,
            error,
            hasClipboardContent,
            isPubkeyValid,
            contactName
        } = this.state;
        const dynamicStyles = this.getDynamicStyles();
        const isFormValid = this.isFormValid();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={() => {
                        navigation.navigate('MintToken', {
                            fromLockSettings: true,
                            pubkey: this.state.pubkey,
                            duration: this.state.duration,
                            ...this.props.route.params
                        });
                    }}
                    navigateBackOnBackPress={false}
                    centerComponent={{
                        text: localeString('cashu.lockEcash'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                    rightComponent={
                        <View>
                            <TouchableOpacity
                                onPress={() =>
                                    navigation.navigate(
                                        'HandleAnythingQRScanner'
                                    )
                                }
                            >
                                <Scan
                                    fill={themeColor('text')}
                                    width={30}
                                    height={30}
                                />
                            </TouchableOpacity>
                        </View>
                    }
                />

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {error && <ErrorMessage message={error} />}

                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Medium',
                            fontSize: 14,
                            color: themeColor('secondaryText'),
                            marginBottom: 8
                        }}
                    >
                        {localeString('cashu.lockEcashDescription')}
                    </Text>

                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: 5
                        }}
                    >
                        <TextInput
                            placeholder={'02abc...'}
                            value={contactName ? '' : pubkey}
                            onChangeText={this.handlePubkeyChange}
                            onFocus={this.checkClipboardContent}
                            style={{
                                flex: 1,
                                paddingHorizontal: 15,
                                paddingRight: 40
                            }}
                            textColor={
                                isPubkeyValid
                                    ? themeColor('text')
                                    : themeColor('delete')
                            }
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                        {contactName && (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    position: 'absolute',
                                    left: 10,
                                    top: 22
                                }}
                            >
                                <Chip
                                    title={contactName}
                                    titleStyle={{
                                        ...styles.text,
                                        color: themeColor('background'),
                                        backgroundColor: themeColor('chain')
                                    }}
                                    // @ts-ignore:next-line
                                    type="inline"
                                    containerStyle={{
                                        backgroundColor: themeColor('chain'),
                                        borderRadius: 8,
                                        paddingRight: 24
                                    }}
                                />
                                <TouchableOpacity
                                    onPress={() => {
                                        this.setState({
                                            pubkey: '',
                                            contactName: '',
                                            error: ''
                                        });
                                    }}
                                    style={{
                                        position: 'absolute',
                                        right: 8,
                                        top: 8
                                    }}
                                >
                                    <Icon
                                        name="close-circle"
                                        type="material-community"
                                        size={18}
                                        color={themeColor('background')}
                                    />
                                </TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity
                            onPress={() => {
                                const { memo, value, satAmount, account } =
                                    this.state;
                                navigation.navigate('Contacts', {
                                    SendScreen: true,
                                    CashuLockSettingsScreen: true,
                                    memo,
                                    value,
                                    satAmount,
                                    account
                                });
                            }}
                            style={{ position: 'absolute', right: 10 }}
                        >
                            <ContactIcon
                                fill={themeColor('text')}
                                width={30}
                                height={30}
                            />
                        </TouchableOpacity>
                    </View>

                    {hasClipboardContent && (
                        <Button
                            icon={{
                                type: 'ionicon',
                                name: 'clipboard-outline',
                                size: 20,
                                color: themeColor('text')
                            }}
                            onPress={this.handlePaste}
                            buttonStyle={{
                                backgroundColor: themeColor('secondary'),
                                borderRadius: 12,
                                height: 48,
                                marginBottom: 15
                            }}
                            containerStyle={{
                                width: '100%'
                            }}
                            titleStyle={{
                                color: themeColor('text'),
                                fontSize: 16,
                                fontFamily: 'PPNeueMontreal-Medium',
                                marginLeft: 2
                            }}
                            title={localeString('general.paste')}
                        />
                    )}

                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: 12
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Medium',
                                fontSize: 16,
                                color: themeColor('text'),
                                marginRight: 8
                            }}
                        >
                            {localeString('cashu.lockFor')}
                        </Text>
                        <View
                            style={{
                                flex: 1,
                                height: 1,
                                backgroundColor: themeColor('secondaryText'),
                                opacity: 0.15
                            }}
                        />
                    </View>

                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 8
                        }}
                    >
                        {DURATION_OPTIONS.map((option) => (
                            <TouchableOpacity
                                key={option}
                                onPress={() => {
                                    if (
                                        option ===
                                        localeString('cashu.duration.custom')
                                    ) {
                                        this.setState({
                                            showCustomDuration: true,
                                            duration: ''
                                        });
                                    } else {
                                        this.setState({
                                            duration:
                                                duration === option
                                                    ? ''
                                                    : option,
                                            showCustomDuration: false,
                                            customDurationValue: '',
                                            error: ''
                                        });
                                    }
                                }}
                                style={{
                                    width: 75,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor:
                                        (option ===
                                            localeString(
                                                'cashu.duration.custom'
                                            ) &&
                                            showCustomDuration) ||
                                        (option !==
                                            localeString(
                                                'cashu.duration.custom'
                                            ) &&
                                            duration === option)
                                            ? themeColor('text')
                                            : themeColor('secondary'),
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    shadowColor: '#000',
                                    shadowOffset: {
                                        width: 0,
                                        height: 2
                                    },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 3,
                                    elevation: 2
                                }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={{
                                        color:
                                            (option ===
                                                localeString(
                                                    'cashu.duration.custom'
                                                ) &&
                                                showCustomDuration) ||
                                            (option !==
                                                localeString(
                                                    'cashu.duration.custom'
                                                ) &&
                                                duration === option)
                                                ? themeColor('secondary')
                                                : themeColor('text'),
                                        fontSize: 14,
                                        fontWeight: '500',
                                        fontFamily: 'PPNeueMontreal-Medium'
                                    }}
                                >
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {showCustomDuration && (
                        <View>
                            <View
                                style={{
                                    borderRadius: 12,
                                    padding: 16,
                                    marginBottom: 5
                                }}
                            >
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 12,
                                        marginBottom: 16
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <TextInput
                                            placeholder={'1-999'}
                                            value={customDurationValue}
                                            onChangeText={
                                                this
                                                    .handleCustomDurationValueChange
                                            }
                                            style={{
                                                height: 48,
                                                borderRadius: 12,
                                                backgroundColor:
                                                    themeColor('secondary'),
                                                borderWidth: 0,
                                                borderColor: 'transparent'
                                            }}
                                            textInputStyle={{
                                                color: themeColor('secondary'),
                                                fontSize: 18,
                                                fontFamily:
                                                    'PPNeueMontreal-Medium',
                                                textAlign: 'center'
                                            }}
                                            keyboardType="number-pad"
                                        />
                                    </View>
                                </View>

                                <View
                                    style={{
                                        flexDirection: 'row',
                                        flexWrap: 'wrap',
                                        gap: 8,
                                        justifyContent: 'center'
                                    }}
                                >
                                    {TIME_UNITS.map((unit) => (
                                        <TouchableOpacity
                                            key={unit}
                                            style={{
                                                paddingVertical: 8,
                                                paddingHorizontal: 16,
                                                borderRadius: 20,
                                                backgroundColor:
                                                    customDurationUnit === unit
                                                        ? themeColor('text')
                                                        : themeColor(
                                                              'secondary'
                                                          ),
                                                minWidth: 80,
                                                alignItems: 'center'
                                            }}
                                            onPress={() => {
                                                this.setState({
                                                    customDurationUnit: unit,
                                                    showUnitDropdown: false
                                                });
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color:
                                                        customDurationUnit ===
                                                        unit
                                                            ? themeColor(
                                                                  'secondary'
                                                              )
                                                            : themeColor(
                                                                  'text'
                                                              ),
                                                    fontSize: 16,
                                                    fontFamily:
                                                        'PPNeueMontreal-Medium',
                                                    textTransform: 'capitalize'
                                                }}
                                            >
                                                {localeString(
                                                    `cashu.timeUnit.${unit}`
                                                )}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {customDurationValue && !this.state.error && (
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Medium',
                                        fontSize: 16,
                                        width: '90%',
                                        margin: 'auto',
                                        color: themeColor('success'),
                                        textAlign: 'center',
                                        backgroundColor:
                                            'rgba(75, 181, 67, 0.1)',
                                        padding: 12,
                                        borderRadius: 8
                                    }}
                                >
                                    {`${customDurationValue} ${
                                        customDurationValue === '1'
                                            ? customDurationUnit
                                            : customDurationUnit + 's'
                                    }`}
                                </Text>
                            )}
                        </View>
                    )}

                    <View style={styles.bottomButtonContainer}>
                        <Button
                            onPress={() => {
                                const navigationParams = {
                                    ...this.props.route.params,
                                    fromLockSettings: true
                                };

                                navigation.navigate(
                                    'MintToken',
                                    navigationParams
                                );
                            }}
                            containerStyle={styles.bottomButton}
                            buttonStyle={dynamicStyles.cancelButton}
                            titleStyle={dynamicStyles.cancelButtonText}
                            title={localeString('cashu.cancel')}
                        />

                        <Button
                            onPress={this.handleSave}
                            containerStyle={styles.bottomButton}
                            buttonStyle={
                                isFormValid
                                    ? dynamicStyles.lockButton
                                    : dynamicStyles.lockButtonDisabled
                            }
                            titleStyle={
                                isFormValid
                                    ? dynamicStyles.lockButtonText
                                    : styles.lockButtonTextDisabled
                            }
                            disabled={!isFormValid}
                            title={localeString('cashu.lock')}
                        />
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        padding: 20
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    bottomButtonContainer: {
        marginTop: 'auto',
        marginBottom: 20,
        gap: 12
    },
    bottomButton: {
        flex: 1
    },
    cancelButton: {
        height: 48,
        borderRadius: 8
    },
    cancelButtonText: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Medium'
    },
    lockButton: {
        height: 48,
        borderRadius: 8
    },
    lockButtonDisabled: {
        backgroundColor: 'transparent'
    },
    lockButtonText: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Medium'
    },
    lockButtonTextDisabled: {
        color: 'rgba(0, 0, 0, 0.3)'
    }
});
