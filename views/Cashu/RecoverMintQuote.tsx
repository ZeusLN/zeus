import * as React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import EcashMintPicker from '../../components/EcashMintPicker';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

import CashuStore from '../../stores/CashuStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface RecoverMintQuoteProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
}

interface RecoverMintQuoteState {
    quoteId: string;
    checking: boolean;
    checked: boolean;
    error: string | null;
    statusMessage: string;
    recoveredAmount: number;
    quoteState: string | null;
    notOnDevice: boolean;
}

@inject('CashuStore')
@observer
export default class RecoverMintQuote extends React.Component<
    RecoverMintQuoteProps,
    RecoverMintQuoteState
> {
    state = {
        quoteId: '',
        checking: false,
        checked: false,
        error: null,
        statusMessage: '',
        recoveredAmount: 0,
        quoteState: null,
        notOnDevice: false
    };

    recover = async () => {
        const { CashuStore } = this.props;
        const { quoteId } = this.state;
        const { selectedMintUrl } = CashuStore;

        if (!selectedMintUrl) {
            this.setState({
                error: localeString(
                    'views.Cashu.LegacySeedRecovery.noMintSelected'
                )
            });
            return;
        }
        const trimmed = quoteId.trim();
        if (!trimmed) {
            this.setState({
                error: localeString('views.Cashu.RecoverMintQuote.noQuoteId')
            });
            return;
        }

        this.setState({
            checking: true,
            checked: false,
            error: null,
            statusMessage: localeString(
                'views.Cashu.RecoverMintQuote.checking'
            ),
            recoveredAmount: 0,
            quoteState: null,
            notOnDevice: false
        });

        try {
            const result = await CashuStore.checkInvoicePaid(
                trimmed,
                selectedMintUrl
            );
            if (result?.isPaid) {
                this.setState({
                    checking: false,
                    checked: true,
                    recoveredAmount: Number(result?.amtSat) || 0,
                    statusMessage: ''
                });
            } else if (result?.isLegacy) {
                this.setState({
                    checking: false,
                    checked: true,
                    notOnDevice: true,
                    statusMessage: ''
                });
            } else {
                this.setState({
                    checking: false,
                    checked: true,
                    quoteState: result?.quoteState || null,
                    statusMessage: ''
                });
            }
        } catch (e: any) {
            this.setState({
                checking: false,
                checked: true,
                error: e?.message || String(e),
                statusMessage: ''
            });
        }
    };

    render() {
        const { navigation } = this.props;
        const {
            quoteId,
            checking,
            checked,
            error,
            statusMessage,
            recoveredAmount,
            quoteState,
            notOnDevice
        } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Cashu.RecoverMintQuote.title'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView style={styles.container}>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 16,
                            marginBottom: 20
                        }}
                    >
                        {localeString(
                            'views.Cashu.RecoverMintQuote.description'
                        )}
                    </Text>

                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Medium',
                            fontSize: 16,
                            marginBottom: 10
                        }}
                    >
                        {localeString('cashu.mint')}
                    </Text>
                    <View style={styles.pickerContainer}>
                        <EcashMintPicker
                            disableRandom
                            navigation={navigation}
                            hideAmount
                            disabled={checking}
                        />
                    </View>

                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Medium',
                            fontSize: 16,
                            marginBottom: 10
                        }}
                    >
                        {localeString('views.Cashu.RecoverMintQuote.quoteId')}
                    </Text>
                    <TextInput
                        value={quoteId}
                        onChangeText={(v) =>
                            this.setState({
                                quoteId: v,
                                error: null,
                                checked: false,
                                recoveredAmount: 0,
                                quoteState: null,
                                notOnDevice: false
                            })
                        }
                        editable={!checking}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder={localeString(
                            'views.Cashu.RecoverMintQuote.quoteIdPlaceholder'
                        )}
                        placeholderTextColor={themeColor('secondaryText')}
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: 14,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: themeColor('secondaryText'),
                            borderRadius: 6,
                            marginBottom: 20
                        }}
                    />

                    <View style={styles.buttonContainer}>
                        <Button
                            title={localeString(
                                'views.Cashu.RecoverMintQuote.recoverButton'
                            )}
                            onPress={this.recover}
                            disabled={checking}
                        />
                    </View>

                    {checking && (
                        <View style={styles.statusContainer}>
                            <LoadingIndicator />
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 14,
                                    marginTop: 10
                                }}
                            >
                                {statusMessage}
                            </Text>
                        </View>
                    )}

                    {error && <ErrorMessage message={error} />}

                    {checked && !error && recoveredAmount > 0 && (
                        <View style={styles.resultContainer}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 16,
                                    textAlign: 'center'
                                }}
                            >
                                {localeString(
                                    'views.Cashu.LegacySeedRecovery.recovered',
                                    { amount: recoveredAmount }
                                )}
                            </Text>
                        </View>
                    )}

                    {checked &&
                        !error &&
                        !notOnDevice &&
                        recoveredAmount === 0 &&
                        quoteState && (
                            <View style={styles.resultContainer}>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 16,
                                        textAlign: 'center'
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.RecoverMintQuote.notReady',
                                        { state: quoteState }
                                    )}
                                </Text>
                            </View>
                        )}

                    {checked && notOnDevice && (
                        <View
                            style={{
                                backgroundColor: themeColor('warning'),
                                padding: 15,
                                borderRadius: 8,
                                marginTop: 20
                            }}
                        >
                            <Text
                                style={{
                                    color: 'white',
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    fontSize: 14,
                                    marginBottom: 8
                                }}
                            >
                                {localeString(
                                    'views.Cashu.RecoverMintQuote.notOnDevice'
                                )}
                            </Text>
                            <Text
                                style={{
                                    color: 'white',
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 13
                                }}
                            >
                                {localeString(
                                    'views.Cashu.RecoverMintQuote.notOnDeviceMessage'
                                )}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20
    },
    pickerContainer: {
        marginBottom: 20
    },
    buttonContainer: {
        marginBottom: 20
    },
    statusContainer: {
        alignItems: 'center',
        marginTop: 20
    },
    resultContainer: {
        marginTop: 20
    }
});
