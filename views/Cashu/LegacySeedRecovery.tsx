import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
// NOTE: cashu-ts is intentionally used here for legacy seed recovery
// Legacy recovery uses a different seed derivation (bytes 32-64 from LND seed)
// and requires cashu-ts's batch restore with start/count parameters.
// CDK's restore method uses a different approach and won't recover legacy proofs.
import {
    CashuMint,
    CashuWallet,
    CheckStateEnum,
    getEncodedToken,
    Proof
} from '@cashu/cashu-ts';
import * as bip39scure from '@scure/bip39';

import Button from '../../components/Button';
import EcashMintPicker from '../../components/EcashMintPicker';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import CashuStore from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';

import handleAnything from '../../utils/handleAnything';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

const BATCH_SIZE = 200;
const MAX_GAP = 2;

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
    currentIndices: string;
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
        currentIndices: ''
    };

    checkLegacyFunds = async () => {
        const { CashuStore, SettingsStore, navigation } = this.props;
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
            currentIndices: ''
        });

        try {
            // Derive legacy seed (bytes 32-64 from LND seed)
            const mnemonic = seedPhrase.join(' ');
            const seedFromMnemonic = await bip39scure.mnemonicToSeed(mnemonic);
            const legacySeed = new Uint8Array(seedFromMnemonic.slice(32, 64));

            const mint = new CashuMint(selectedMintUrl);
            const mintInfo = await mint.getInfo();

            this.setState({
                statusMessage: `${localeString(
                    'views.Cashu.LegacySeedRecovery.checkingMint'
                )} ${mintInfo.name || selectedMintUrl}`
            });

            const { keysets } = await mint.getKeySets();

            let allProofs: Proof[] = [];

            for (let i = 0; i < keysets.length; i++) {
                const keyset = keysets[i];

                this.setState({
                    statusMessage: `${localeString(
                        'views.Cashu.LegacySeedRecovery.checkingKeyset'
                    )} ${i + 1}/${keysets.length}`
                });

                try {
                    const wallet = new CashuWallet(mint, {
                        bip39seed: legacySeed,
                        unit: keyset.unit || 'sat'
                    });

                    await wallet.loadMint();

                    let start = 0;
                    let emptyBatchCount = 0;
                    let restoreProofs: Proof[] = [];

                    // Restore proofs in batches with gap limit
                    while (emptyBatchCount < MAX_GAP) {
                        this.setState({
                            currentIndices: `${start} - ${start + BATCH_SIZE}`
                        });

                        let proofs: Proof[] = [];
                        try {
                            const result = await wallet.restore(
                                start,
                                BATCH_SIZE,
                                { keysetId: keyset.id }
                            );
                            proofs = result.proofs || [];
                        } catch (error: any) {
                            console.log(
                                `Error restoring batch: ${error.message}`
                            );
                            proofs = [];
                        }

                        if (proofs.length === 0) {
                            emptyBatchCount++;
                        } else {
                            restoreProofs = restoreProofs.concat(proofs);
                            emptyBatchCount = 0;
                        }
                        start += BATCH_SIZE;
                    }

                    if (restoreProofs.length === 0) {
                        continue;
                    }

                    // Check which proofs are still unspent
                    let unspentProofs: Proof[] = [];
                    for (let j = 0; j < restoreProofs.length; j += BATCH_SIZE) {
                        const batch = restoreProofs.slice(j, j + BATCH_SIZE);
                        const proofStates = await wallet.checkProofsStates(
                            batch
                        );

                        const unspent = batch.filter(
                            (_, idx: number) =>
                                proofStates[idx].state !== CheckStateEnum.SPENT
                        );
                        unspentProofs = unspentProofs.concat(unspent);
                    }

                    if (unspentProofs.length > 0) {
                        allProofs.push(...unspentProofs);
                    }
                } catch (err: any) {
                    console.log(`Error checking keyset: ${err.message}`);
                }
            }

            if (allProofs.length > 0) {
                // Create a Cashu token and process it
                const token = getEncodedToken({
                    mint: selectedMintUrl,
                    proofs: allProofs
                });

                this.setState({
                    checking: false,
                    checked: false,
                    statusMessage: ''
                });

                // Let handleAnything navigate to the CashuToken view
                await handleAnything(token)
                    .then(([route, props]) => {
                        navigation.navigate(route, props);
                    })
                    .catch((err) => {
                        this.setState({
                            checking: false,
                            checked: true,
                            error: err.message,
                            statusMessage: ''
                        });
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
            currentIndices
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
                            {currentIndices && (
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 14,
                                        marginTop: 5
                                    }}
                                >
                                    {localeString(
                                        'views.Cashu.LegacySeedRecovery.checkingIndices'
                                    )}
                                    : {currentIndices}
                                </Text>
                            )}
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
