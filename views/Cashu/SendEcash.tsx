import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AmountInput, { getSatAmount } from '../../components/AmountInput';
import Button from '../../components/Button';
import EcashMintPicker from '../../components/EcashMintPicker';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import CashuToken from '../../models/CashuToken';

import CashuStore from '../../stores/CashuStore';
import ContactStore from '../../stores/ContactStore';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

export interface SendEcashParams {
    amount?: string;
    pubkey?: string;
    contactName?: string;
    locktime?: number;
    memo?: string;
    value?: string;
    satAmount?: string | number;
    account?: string;
    duration?: string;
    fromLockSettings?: boolean;
    showCustomDuration?: boolean;
    customDurationValue?: string;
    customDurationUnit?: string;
}

interface SendEcashProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ContactStore: ContactStore;
    route: Route<'SendEcash', SendEcashParams>;
}

interface SendEcashState {
    loading: boolean;
    memo: string;
    value: string;
    satAmount: string | number;
    pubkey: string;
    contactName: string;
    locktime?: number;
    duration: string;
    showCustomDuration: boolean;
    customDurationValue: string;
    customDurationUnit: string;
}

@inject('CashuStore', 'UnitsStore', 'ContactStore')
@observer
export default class SendEcash extends React.Component<
    SendEcashProps,
    SendEcashState
> {
    constructor(props: SendEcashProps) {
        super(props);
        this.state = {
            loading: true,
            memo: '',
            value: '',
            satAmount: '',
            pubkey: '',
            contactName: '',
            duration: '',
            showCustomDuration: false,
            customDurationValue: '',
            customDurationUnit: ''
        };
        this.handleLockSettingsSave = this.handleLockSettingsSave.bind(this);
        this.resetForm = this.resetForm.bind(this);
        this.handleLockSettingsPress = this.handleLockSettingsPress.bind(this);
    }

    async UNSAFE_componentWillMount() {
        const { CashuStore, route } = this.props;
        const { clearToken } = CashuStore;

        clearToken();

        const params: SendEcashParams = route.params ?? {};
        const { amount } = params;

        if (amount && amount != '0') {
            this.setState({
                value: amount,
                satAmount: getSatAmount(amount)
            });
        }
        this.setState({
            loading: false
        });

        this.props.navigation.addListener('focus', this.handleScreenFocus);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener('focus', this.handleScreenFocus);
    }

    handleScreenFocus = () => {
        const { route } = this.props;
        const params: SendEcashParams = route.params || {};

        if (params.fromLockSettings) {
            const stateUpdate: Partial<SendEcashState> = {
                pubkey: params.pubkey ?? this.state.pubkey,
                duration: params.duration ?? this.state.duration,
                locktime: this.convertDurationToSeconds(params.duration),
                memo: params.memo ?? this.state.memo,
                value: params.value ?? this.state.value,
                satAmount: params.satAmount ?? this.state.satAmount,
                contactName: params.contactName ?? this.state.contactName,
                showCustomDuration:
                    params.showCustomDuration ?? this.state.showCustomDuration,
                customDurationValue:
                    params.customDurationValue ??
                    this.state.customDurationValue,
                customDurationUnit:
                    params.customDurationUnit ?? this.state.customDurationUnit
            };
            this.setState(stateUpdate as SendEcashState, () => {
                const updatedParams = { ...params };
                delete updatedParams.fromLockSettings;
                this.props.navigation.setParams(updatedParams);
            });
        }
    };

    convertDurationToSeconds = (
        duration: string | undefined
    ): number | undefined => {
        if (!duration || duration === '') return undefined;
        if (duration === 'forever') {
            return undefined;
        }
        const parts = duration.split(' ');
        if (parts.length !== 2) return 0;
        const value = parseInt(parts[0], 10);
        const unit = parts[1];
        if (isNaN(value) || value <= 0) return 0;
        switch (unit) {
            case 'Hour':
            case 'Hours':
                return value * 3600;
            case 'Day':
            case 'Days':
                return value * 86400;
            case 'Week':
            case 'Weeks':
                return value * 604800;
            case 'Month':
            case 'Months':
                return value * 2592000;
            case 'Year':
            case 'Years':
                return value * 31536000;
            default:
                return 0;
        }
    };

    handleLockSettingsSave = (pubkey: string, duration: string) => {
        const locktime = this.convertDurationToSeconds(duration);

        this.setState({
            pubkey,
            locktime,
            duration
        });
    };

    resetForm() {
        this.setState({
            memo: '',
            value: '',
            satAmount: '',
            pubkey: '',
            duration: '',
            locktime: undefined,
            contactName: '',
            showCustomDuration: false,
            customDurationValue: '',
            customDurationUnit: ''
        });

        // Reset all params at once
        this.props.navigation.setParams({} as SendEcashParams);
    }

    handleLockSettingsPress = () => {
        const { navigation, route } = this.props;
        const params: SendEcashParams = route.params || {};
        const {
            memo,
            value,
            satAmount,
            pubkey,
            duration,
            contactName,
            showCustomDuration,
            customDurationValue,
            customDurationUnit
        } = this.state;
        navigation.navigate('CashuLockSettings', {
            ...params,
            currentLockPubkey: pubkey,
            currentDuration: duration,
            fromMintToken: true,
            memo,
            value,
            satAmount,
            contactName,
            showCustomDuration,
            customDurationValue,
            customDurationUnit
        });
    };

    formatPubkey = (pubkey: string | undefined): string => {
        if (!pubkey || typeof pubkey !== 'string' || pubkey.length < 10)
            return '';
        return `${pubkey.slice(0, 6)}...${pubkey.slice(-4)}`;
    };
    formatDuration = (duration: string | undefined): string => {
        if (!duration) return localeString('cashu.noDuration');
        return duration;
    };
    onBack = () => {
        const { navigation } = this.props;
        navigation.popTo('Wallet');
    };
    handleMemoChange = (text: string) => {
        this.setState({ memo: text });
    };
    handleAmountChange = (amount: string, satAmount: string | number) => {
        this.setState({
            value: amount,
            satAmount
        });
    };

    render() {
        const { CashuStore, navigation } = this.props;
        const { memo, value, satAmount, pubkey, duration } = this.state;

        const { mintToken, mintingToken, loadingMsg } = CashuStore;
        const loading = CashuStore.loading || this.state.loading;

        const error_msg = CashuStore.error_msg;

        const isAmountValid = satAmount && Number(satAmount) > 0;

        const handleMintEcashToken = () => {
            const lockSeconds = pubkey
                ? this.convertDurationToSeconds(duration)
                : 0;

            const params = {
                memo,
                value: satAmount.toString() || '0',
                ...(pubkey && {
                    pubkey,
                    lockTime:
                        lockSeconds && lockSeconds > 0
                            ? Math.floor(Date.now() / 1000) + lockSeconds
                            : undefined
                })
            };
            mintToken(params).then(
                (
                    result:
                        | {
                              token: string;
                              decoded: CashuToken;
                          }
                        | undefined
                ) => {
                    if (result?.token && result.decoded) {
                        const { token, decoded } = result;
                        this.resetForm();
                        navigation.navigate('CashuToken', {
                            token,
                            decoded
                        });
                    }
                }
            );
        };

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    navigateBackOnBackPress={false}
                    onBack={this.onBack}
                    centerComponent={{
                        text: localeString('cashu.sendEcash'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ flex: 1 }}>
                    <ScrollView
                        style={styles.content}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                    >
                        {error_msg && <ErrorMessage message={error_msg} />}

                        <View>
                            {(mintingToken || loading) && (
                                <View style={{ marginTop: 40 }}>
                                    <LoadingIndicator />
                                    {loadingMsg && (
                                        <Text
                                            style={{
                                                marginTop: 35,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize: 16,
                                                color: themeColor('text'),
                                                textAlign: 'center'
                                            }}
                                        >
                                            {loadingMsg}
                                        </Text>
                                    )}
                                </View>
                            )}
                            {!loading && !mintingToken && (
                                <>
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString('cashu.mint')}
                                        </Text>
                                        <View
                                            style={{
                                                marginTop: 10,
                                                marginBottom: 10
                                            }}
                                        >
                                            <EcashMintPicker
                                                navigation={navigation}
                                            />
                                        </View>
                                    </>
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString('views.Receive.memo')}
                                        </Text>
                                        <TextInput
                                            placeholder={localeString(
                                                'views.Receive.memoPlaceholder'
                                            )}
                                            value={memo}
                                            onChangeText={this.handleMemoChange}
                                        />
                                    </>

                                    <AmountInput
                                        amount={value}
                                        title={localeString(
                                            'views.Receive.amount'
                                        )}
                                        onAmountChange={this.handleAmountChange}
                                    />

                                    {/* Lock to Pubkey (optional) field */}
                                    <View style={styles.lockContainer}>
                                        <Button
                                            icon={{
                                                type: 'ionicon',
                                                name: pubkey
                                                    ? 'lock-closed-outline'
                                                    : 'lock-open-outline',
                                                size: 20,
                                                color: themeColor('text')
                                            }}
                                            title={
                                                pubkey && pubkey.length > 0
                                                    ? `${this.formatPubkey(
                                                          pubkey
                                                      )} (${this.formatDuration(
                                                          duration
                                                      )})`
                                                    : localeString(
                                                          'cashu.lockToPubkey'
                                                      )
                                            }
                                            onPress={
                                                this.handleLockSettingsPress
                                            }
                                            containerStyle={
                                                styles.lockButtonContainer
                                            }
                                            secondary={true}
                                            buttonStyle={{
                                                ...styles.lockButton,
                                                backgroundColor:
                                                    themeColor('secondary'),
                                                borderColor: themeColor('text')
                                            }}
                                            titleStyle={{
                                                ...styles.lockButtonText,
                                                color: themeColor('text')
                                            }}
                                        />
                                    </View>

                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'cashu.sendEcash'
                                            )}
                                            onPress={handleMintEcashToken}
                                            buttonStyle={{
                                                backgroundColor: isAmountValid
                                                    ? themeColor('text')
                                                    : themeColor('secondary')
                                            }}
                                            titleStyle={{
                                                color: isAmountValid
                                                    ? themeColor('secondary')
                                                    : themeColor('text')
                                            }}
                                            disabled={!isAmountValid}
                                        />
                                    </View>
                                </>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    button: {
        paddingTop: 25,
        paddingBottom: 15
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    lockContainer: {
        marginTop: 20,
        marginBottom: 10
    },
    lockButtonContainer: {
        width: '90%',
        alignSelf: 'center'
    },
    lockButton: {
        opacity: 0.8,
        height: 45
    },
    lockButtonText: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
