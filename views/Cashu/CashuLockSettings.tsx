import * as React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Clipboard from '@react-native-clipboard/clipboard';
import { Chip, Icon, ButtonGroup } from 'react-native-elements';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Button from '../../components/Button';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';
import DropdownSetting from '../../components/DropdownSetting';
import ContactStore from '../../stores/ContactStore';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import AddressUtils from '../../utils/AddressUtils';
import Scan from '../../assets/images/SVG/Scan.svg';
import ContactIcon from '../../assets/images/SVG/PeersContact.svg';
import { SendEcashParams } from './SendEcash';

export interface CashuLockSettingsParams extends SendEcashParams {
    onSave?: (pubkey: string, duration: string) => void;
    currentLockPubkey?: string;
    currentDuration?: string;
    destination?: string | null;
    hasCashuPubkey?: boolean;
    selectedDurationIndex?: number;
}
interface CashuLockSettingsProps {
    navigation: StackNavigationProp<any, any>;
    ContactStore: ContactStore;
    route: Route<'CashuLockSettings', CashuLockSettingsParams>;
}
interface CashuLockSettingsState {
    pubkey: string;
    contactName: string;
    duration: string;
    showCustomDuration: boolean;
    customDurationValue: string;
    customDurationUnit: string;
    showUnitDropdown: boolean;
    memo: string;
    value: string;
    satAmount: string | number;
    error: string;
    hasClipboardContent: boolean;
    isPubkeyValid: boolean;
    selectedDurationIndex: number;
}

const TIME_UNITS: string[] = [
    localeString('time.hours'),
    localeString('time.days'),
    localeString('time.weeks'),
    localeString('time.months'),
    localeString('time.years')
];

const DURATION_OPTIONS: string[] = [
    localeString('cashu.duration.1Day'),
    localeString('cashu.duration.1Week'),
    localeString('cashu.duration.forever'),
    localeString('general.custom')
];

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
            showCustomDuration,
            customDurationValue,
            customDurationUnit,
            duration,
            selectedDurationIndex
        } = route.params || {};

        this.state = {
            pubkey: currentLockPubkey || '',
            contactName: contactName || '',
            duration: duration || currentDuration || DURATION_OPTIONS[0],
            showCustomDuration: showCustomDuration || false,
            customDurationValue: customDurationValue || '',
            customDurationUnit: customDurationUnit || TIME_UNITS[0],
            showUnitDropdown: false,
            memo: memo || '',
            value: value || '',
            satAmount: satAmount || '',
            error: '',
            hasClipboardContent: false,
            isPubkeyValid: currentLockPubkey
                ? AddressUtils.isValidLightningPubKey(currentLockPubkey)
                : true,
            selectedDurationIndex:
                selectedDurationIndex !== undefined
                    ? selectedDurationIndex
                    : currentDuration
                    ? DURATION_OPTIONS.indexOf(currentDuration)
                    : 0
        };
        this.handleContactSelection = this.handleContactSelection.bind(this);
    }

    componentDidMount() {
        this.props.navigation.addListener('focus', this.handleFocus);
        const { route } = this.props;
        const { showCustomDuration, customDurationValue, customDurationUnit } =
            route.params || {};
        if (showCustomDuration) {
            this.setState({
                showCustomDuration: true,
                selectedDurationIndex: 3,
                customDurationValue: customDurationValue || '',
                customDurationUnit: customDurationUnit || TIME_UNITS[0]
            });
        }
    }

    componentWillUnmount() {
        this.props.navigation.removeListener('focus', this.handleFocus);
    }

    handleFocus = () => {
        const { route } = this.props;
        const params: CashuLockSettingsParams = route.params || {};
        if (params.destination) {
            this.setState({
                contactName: params.contactName || '',
                pubkey: params.destination,
                duration: params.duration || this.state.duration,
                showCustomDuration:
                    params.showCustomDuration ?? this.state.showCustomDuration,
                customDurationValue:
                    params.customDurationValue ||
                    this.state.customDurationValue,
                customDurationUnit:
                    params.customDurationUnit || this.state.customDurationUnit,
                selectedDurationIndex:
                    params.selectedDurationIndex ??
                    this.state.selectedDurationIndex,
                error: ''
            });
        }
        this.props.navigation.setParams({} as SendEcashParams);
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
        const { pubkey, showCustomDuration, customDurationValue } = this.state;
        if (!pubkey) {
            return localeString('cashu.pubkeyRequired');
        }
        if (!AddressUtils.isValidLightningPubKey(pubkey)) {
            return localeString('cashu.invalidCashuPubkey');
        }
        if (showCustomDuration) {
            return this.validateCustomDurationValue(customDurationValue);
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
        const baseUnit = customDurationUnit.endsWith('s')
            ? customDurationUnit.slice(0, -1)
            : customDurationUnit;
        const finalUnit = value === 1 ? baseUnit : baseUnit + 's';
        const capitalizedUnit =
            finalUnit.charAt(0).toUpperCase() + finalUnit.slice(1);

        return `${value} ${capitalizedUnit}`;
    };

    handleSave = () => {
        const {
            pubkey,
            showCustomDuration,
            customDurationValue,
            customDurationUnit,
            memo,
            value,
            satAmount,
            contactName,
            selectedDurationIndex
        } = this.state;

        const error = this.validateForm();
        if (error) {
            this.setState({ error });
            return;
        }

        const finalDuration = showCustomDuration
            ? this.getCustomDurationString()
            : DURATION_OPTIONS[selectedDurationIndex];

        const params: SendEcashParams = {
            pubkey,
            duration: finalDuration,
            fromLockSettings: true,
            memo,
            value,
            satAmount,
            contactName,
            showCustomDuration,
            ...(showCustomDuration && {
                customDurationValue,
                customDurationUnit
            })
        };
        this.props.navigation.popTo('SendEcash', params);
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

    isFormValid = () => {
        const {
            pubkey,
            showCustomDuration,
            customDurationValue,
            error,
            selectedDurationIndex
        } = this.state;
        const isPubkeyValid =
            pubkey && AddressUtils.isValidLightningPubKey(pubkey) && !error;
        if (showCustomDuration) {
            return isPubkeyValid && customDurationValue && !error;
        }
        return isPubkeyValid && selectedDurationIndex !== undefined;
    };

    onBack = () => {
        const params: SendEcashParams = {
            fromLockSettings: true,
            pubkey: '',
            duration: '',
            showCustomDuration: false
        };
        this.props.navigation.popTo('SendEcash', params);
    };

    render() {
        const { navigation } = this.props;
        const {
            pubkey,
            showCustomDuration,
            customDurationValue,
            customDurationUnit,
            error,
            hasClipboardContent,
            isPubkeyValid,
            contactName,
            selectedDurationIndex
        } = this.state;
        const isFormValid = this.isFormValid();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={this.onBack}
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
                                const {
                                    memo,
                                    value,
                                    satAmount,
                                    duration,
                                    showCustomDuration,
                                    customDurationValue,
                                    customDurationUnit,
                                    selectedDurationIndex
                                } = this.state;
                                navigation.navigate('Contacts', {
                                    SendScreen: true,
                                    CashuLockSettingsScreen: true,
                                    memo,
                                    value,
                                    satAmount,
                                    duration,
                                    showCustomDuration,
                                    customDurationValue,
                                    customDurationUnit,
                                    selectedDurationIndex
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
                                borderRadius: 5,
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

                    <ButtonGroup
                        onPress={(selectedIndex: number) => {
                            if (selectedIndex === 3) {
                                this.setState({
                                    showCustomDuration: true,
                                    duration: '',
                                    selectedDurationIndex: selectedIndex
                                });
                            } else {
                                this.setState({
                                    duration: DURATION_OPTIONS[selectedIndex],
                                    showCustomDuration: false,
                                    customDurationValue: '',
                                    error: '',
                                    selectedDurationIndex: selectedIndex
                                });
                            }
                        }}
                        selectedIndex={selectedDurationIndex}
                        buttons={DURATION_OPTIONS}
                        textStyle={{
                            color: themeColor('text')
                        }}
                        selectedTextStyle={{
                            color: themeColor('secondary')
                        }}
                        containerStyle={{
                            backgroundColor: themeColor('secondary'),
                            borderRadius: 12,
                            borderColor: themeColor('secondary')
                        }}
                        innerBorderStyle={{
                            color: themeColor('secondary')
                        }}
                        selectedButtonStyle={{
                            backgroundColor: themeColor('highlight'),
                            borderRadius: 12
                        }}
                    />

                    {showCustomDuration && (
                        <View>
                            <View
                                style={{
                                    padding: 10,
                                    marginBottom: 5
                                }}
                            >
                                <Row style={{ width: '100%' }}>
                                    <TextInput
                                        placeholder={'1-999'}
                                        textColor={themeColor('text')}
                                        keyboardType="numeric"
                                        value={customDurationValue}
                                        style={{
                                            width: '58%'
                                        }}
                                        onChangeText={
                                            this.handleCustomDurationValueChange
                                        }
                                    />
                                    <Spacer width={4} />
                                    <View style={{ flex: 1 }}>
                                        <DropdownSetting
                                            selectedValue={customDurationUnit}
                                            values={TIME_UNITS.map((unit) => ({
                                                key: unit,
                                                value: unit,
                                                description: unit
                                            }))}
                                            onValueChange={(value) => {
                                                this.setState({
                                                    customDurationUnit: value,
                                                    showUnitDropdown: false
                                                });
                                            }}
                                        />
                                    </View>
                                </Row>
                            </View>
                        </View>
                    )}

                    <View style={styles.bottomButtonContainer}>
                        <Button
                            onPress={this.handleSave}
                            containerStyle={styles.bottomButton}
                            buttonStyle={{
                                backgroundColor: isFormValid
                                    ? themeColor('text')
                                    : themeColor('secondary')
                            }}
                            titleStyle={{
                                color: isFormValid
                                    ? themeColor('secondary')
                                    : themeColor('text')
                            }}
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
    }
});
