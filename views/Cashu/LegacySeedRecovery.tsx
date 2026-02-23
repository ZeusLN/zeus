import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import * as bip39scure from '@scure/bip39';
import { bytesToHex } from '@noble/hashes/utils';

import CashuDevKit from '../../cashu-cdk';

import Button from '../../components/Button';
import EcashMintPicker from '../../components/EcashMintPicker';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import CashuStore from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface LegacySeedRecoveryProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    SettingsStore: SettingsStore;
}

interface LegacySeedRecoveryState {
    checking: boolean;
    checked: boolean;
    error: string | null;
    noFundsFound: boolean;
    statusMessage: string;
    recoveredAmount: number;
}

@inject('CashuStore', 'SettingsStore')
@observer
export default class LegacySeedRecovery extends React.Component<
    LegacySeedRecoveryProps,
    LegacySeedRecoveryState
> {
    state = {
        checking: false,
        checked: false,
        error: null,
        noFundsFound: false,
        statusMessage: '',
        recoveredAmount: 0
    };

    checkLegacyFunds = async () => {
        const { CashuStore, SettingsStore } = this.props;
        const { selectedMintUrl } = CashuStore;
        const { seedPhrase } = SettingsStore;

        if (!selectedMintUrl) {
            this.setState({
                error: localeString(
                    'views.Cashu.LegacySeedRecovery.noMintSelected'
                )
            });
            return;
        }

        if (!seedPhrase || seedPhrase.length === 0) {
            this.setState({
                error: localeString(
                    'views.Cashu.LegacySeedRecovery.noSeedPhrase'
                )
            });
            return;
        }

        this.setState({
            checking: true,
            checked: false,
            error: null,
            noFundsFound: false,
            statusMessage: localeString(
                'views.Cashu.LegacySeedRecovery.connecting'
            ),
            recoveredAmount: 0
        });

        try {
            // Derive legacy seed (bytes 32-64 from LND seed)
            const mnemonic = seedPhrase.join(' ');
            const seedFromMnemonic = bip39scure.mnemonicToSeedSync(mnemonic);
            const legacySeed = new Uint8Array(seedFromMnemonic.slice(32, 64));
            const seedHex = bytesToHex(legacySeed);

            this.setState({
                statusMessage: localeString(
                    'views.Cashu.LegacySeedRecovery.checkingMint'
                )
            });

            const amount = await CashuDevKit.restoreFromSeed(
                selectedMintUrl,
                seedHex
            );

            if (amount > 0) {
                await CashuStore.syncCDKBalances();
                this.setState({
                    checking: false,
                    checked: true,
                    recoveredAmount: amount,
                    statusMessage: ''
                });
            } else {
                this.setState({
                    checking: false,
                    checked: true,
                    noFundsFound: true,
                    statusMessage: ''
                });
            }
        } catch (error: any) {
            this.setState({
                checking: false,
                checked: true,
                error: error.message,
                statusMessage: ''
            });
        }
    };

    render() {
        const { navigation } = this.props;
        const {
            checking,
            checked,
            error,
            noFundsFound,
            statusMessage,
            recoveredAmount
        } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Cashu.LegacySeedRecovery.title'
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
                            'views.Cashu.LegacySeedRecovery.description'
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
                        {localeString(
                            'views.Cashu.LegacySeedRecovery.selectMint'
                        )}
                    </Text>
                    <View style={styles.pickerContainer}>
                        <EcashMintPicker
                            navigation={navigation}
                            hideAmount
                            disabled={checking}
                        />
                    </View>

                    <View style={styles.buttonContainer}>
                        <Button
                            title={localeString(
                                'views.Cashu.LegacySeedRecovery.checkButton'
                            )}
                            onPress={this.checkLegacyFunds}
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

                    {error && (
                        <View
                            style={{
                                backgroundColor: themeColor('error'),
                                padding: 15,
                                borderRadius: 8,
                                marginTop: 20
                            }}
                        >
                            <Text
                                style={{
                                    color: 'white',
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 14
                                }}
                            >
                                {error}
                            </Text>
                        </View>
                    )}

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
                                {`${localeString(
                                    'views.Cashu.LegacySeedRecovery.recovered'
                                )} ${recoveredAmount} sats`}
                            </Text>
                        </View>
                    )}

                    {checked && !error && noFundsFound && (
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
                                    'views.Cashu.LegacySeedRecovery.noFundsFound'
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
