import * as React from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
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

import CashuStore from '../../stores/CashuStore';
import ContactStore from '../../stores/ContactStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import CashuToken from '../../models/CashuToken';

interface MintTokenProps {
    exitSetup: any;
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    ContactStore: ContactStore;
    route: Route<
        'MintToken',
        {
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
        }
    >;
}

interface MintTokenState {
    loading: boolean;
    memo: string;
    value: string;
    satAmount: string | number;
    pubkey: string;
    contactName: string;
    locktime?: number;
    duration: string;
}

@inject('CashuStore', 'UnitsStore', 'ContactStore')
@observer
export default class MintToken extends React.Component<
    MintTokenProps,
    MintTokenState
> {
    constructor(props: MintTokenProps) {
        super(props);
        this.state = {
            loading: true,
            memo: '',
            value: '',
            satAmount: '',
            pubkey: '', // For Locking token
            contactName: '', // For Locking token
            duration: ''
        };
        this.handleLockSettingsSave = this.handleLockSettingsSave.bind(this);
        this.resetForm = this.resetForm.bind(this);
        this.handleLockSettingsPress = this.handleLockSettingsPress.bind(this);
    }

    async UNSAFE_componentWillMount() {
        const { CashuStore, route } = this.props;
        const { clearToken } = CashuStore;

        clearToken();

        const { amount } = route.params ?? {};

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
        const params = route.params || {};

        if (params.fromLockSettings) {
            const stateUpdate: Partial<MintTokenState> = {
                pubkey: params.pubkey ?? this.state.pubkey,
                duration: params.duration ?? this.state.duration,
                locktime: this.convertDurationToSeconds(params.duration),
                memo: params.memo ?? this.state.memo,
                value: params.value ?? this.state.value,
                satAmount: params.satAmount ?? this.state.satAmount,
                contactName: params.contactName ?? this.state.contactName
            };

            this.setState(stateUpdate as MintTokenState, () => {
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
        const unit = parts[1].toLowerCase();
        if (isNaN(value) || value <= 0) return 0;
        switch (unit) {
            case 'hour':
            case 'hours':
                return value * 3600;
            case 'day':
            case 'days':
                return value * 86400;
            case 'week':
            case 'weeks':
                return value * 604800;
            case 'month':
            case 'months':
                return value * 2592000;
            case 'year':
            case 'years':
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
            locktime: undefined
        });
    }

    handleLockSettingsPress = () => {
        const { navigation } = this.props;
        const { memo, value, satAmount, pubkey, duration, contactName } =
            this.state;
        navigation.navigate('CashuLockSettings', {
            currentLockPubkey: pubkey,
            currentDuration: duration,
            fromMintToken: true,
            memo,
            value,
            satAmount,
            contactName
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

    handleBack = () => {
        const { navigation } = this.props;
        navigation.navigate('Wallet', { fromMintToken: true });
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
        const { fontScale } = Dimensions.get('window');

        const { mintToken, mintingToken, loadingMsg } = CashuStore;
        const loading = CashuStore.loading || this.state.loading;

        const error_msg = CashuStore.error_msg;

        const dynamicStyles = {
            text: {
                ...styles.text,
                color: themeColor('secondaryText')
            },
            loadingText: {
                marginTop: 35,
                fontFamily: 'PPNeueMontreal-Book',
                fontSize: 16 / fontScale,
                color: themeColor('text'),
                textAlign: 'center' as const
            },
            lockButton: {
                ...styles.lockButton,
                backgroundColor: themeColor('secondary'),
                borderColor: themeColor('text')
            },
            lockButtonText: {
                ...styles.lockButtonText,
                color: themeColor('text')
            }
        };

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    navigateBackOnBackPress={false}
                    onBack={this.handleBack}
                    centerComponent={{
                        text: localeString('cashu.mintEcashToken'),
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
                                        <Text style={dynamicStyles.loadingText}>
                                            {loadingMsg}
                                        </Text>
                                    )}
                                </View>
                            )}
                            {!loading && !mintingToken && (
                                <>
                                    <>
                                        <Text style={dynamicStyles.text}>
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
                                        <Text style={dynamicStyles.text}>
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
                                            buttonStyle={
                                                dynamicStyles.lockButton
                                            }
                                            titleStyle={
                                                dynamicStyles.lockButtonText
                                            }
                                        />
                                    </View>

                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'cashu.mintEcashToken'
                                            )}
                                            onPress={() => {
                                                const lockSeconds = pubkey
                                                    ? this.convertDurationToSeconds(
                                                          duration
                                                      )
                                                    : 0;
                                                const params: any = {
                                                    memo,
                                                    value:
                                                        satAmount.toString() ||
                                                        '0'
                                                };

                                                if (pubkey) {
                                                    params.pubkey = pubkey;
                                                    params.lockTime =
                                                        lockSeconds;
                                                }
                                                this.resetForm();
                                                mintToken(params).then(
                                                    (
                                                        result:
                                                            | {
                                                                  token: string;
                                                                  decoded: CashuToken;
                                                              }
                                                            | undefined
                                                    ) => {
                                                        if (
                                                            result?.token &&
                                                            result.decoded
                                                        ) {
                                                            const {
                                                                token,
                                                                decoded
                                                            } = result;
                                                            navigation.navigate(
                                                                'CashuToken',
                                                                {
                                                                    token,
                                                                    decoded
                                                                }
                                                            );
                                                        }
                                                    }
                                                );
                                            }}
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
