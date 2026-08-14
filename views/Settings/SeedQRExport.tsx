import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Route } from '@react-navigation/native';
import { Tab } from '@rneui/themed';

import BIP32Factory from 'bip32';
import ecc from '../../zeus_modules/noble_ecc';

// You must wrap a tiny-secp256k1 compatible implementation
const bip32 = BIP32Factory(ecc);

import Button from '../../components/Button';
import CollapsedQR from '../../components/CollapsedQR';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import {
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';

import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';

import { decodeAezeedEntropy } from '../../utils/AezeedUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import Storage from '../../storage';

interface SeedQRExportProps {
    navigation: NativeStackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    route: Route<
        'SeedQRExport',
        {
            seedPhrase?: string[];
            isTestNet?: boolean;
        }
    >;
}

interface SeedQRExportState {
    tab: number;
    loading: boolean;
    nodeBase58Segwit: string;
    nodeBase58NativeSegwit: string;
    error: string;
}

@inject('NodeInfoStore', 'SettingsStore')
@observer
export default class SeedQRExport extends React.PureComponent<
    SeedQRExportProps,
    SeedQRExportState
> {
    state = {
        tab: 0,
        loading: true,
        nodeBase58Segwit: '',
        nodeBase58NativeSegwit: '',
        error: ''
    };

    componentDidMount() {
        this.initializeSeed();
    }

    async initializeSeed() {
        try {
            await this.props.SettingsStore.getSettings();
            const { NodeInfoStore, SettingsStore, route } = this.props;
            // Prefer the seed passed from the Seed screen so QR export matches
            // the wallet being viewed (inactive wallets are not in SettingsStore).
            const seedFromRoute = route.params?.seedPhrase;
            const isTestNet =
                route.params?.isTestNet ?? NodeInfoStore!.nodeInfo.isTestNet;
            const seedPhrase: string[] =
                seedFromRoute || SettingsStore.seedPhrase;

            // Never persist derived extended private keys. Always recompute
            // them from the seed below, and proactively delete any cache
            // written by older builds so the wallet's HD master keys do not
            // linger in the keychain after wallet deletion / data wipe
            // (KEY-006: '<pubkey>-extended-private-keys' had no deletion path).
            // NodeInfoStore.getNodeInfo also purges on connect; this read-site
            // purge is belt and braces for when nodeInfo is already loaded.
            if (!seedFromRoute) {
                const pubkey = NodeInfoStore!.nodeInfo?.nodeId;
                if (pubkey) {
                    await Storage.removeItem(`${pubkey}-extended-private-keys`);
                }
            }

            let entropy: string;
            try {
                entropy = (await decodeAezeedEntropy(seedPhrase)).toString(
                    'hex'
                );
            } catch (e: any) {
                this.setState({
                    loading: false,
                    error: e.message
                });
                return;
            }

            const SEGWIT_MAINNET = {
                label: 'BTC (Bitcoin, SegWit, BIP49)',
                config: {
                    messagePrefix: '\u0018Bitcoin Signed Message:\n',
                    bech32: 'bc',
                    bip32: {
                        public: 0x049d7cb2,
                        private: 0x049d7878
                    },
                    pubKeyHash: 0,
                    scriptHash: 5,
                    wif: 128,
                    bip44: 0x00
                }
            };

            const SEGWIT_TESTNET = {
                label: 'BTC (Bitcoin Testnet, SegWit, BIP49)',
                config: {
                    messagePrefix: '\u0018Bitcoin Signed Message:\n',
                    bech32: 'tb',
                    bip32: {
                        public: 0x044a5262,
                        private: 0x044a4e28
                    },
                    pubKeyHash: 111,
                    scriptHash: 196,
                    wif: 239,
                    bip44: 0x01
                }
            };

            const NATIVE_SEGWIT_MAINNET = {
                label: 'BTC (Bitcoin, Native SegWit, BIP84)',
                config: {
                    messagePrefix: '\u0018Bitcoin Signed Message:\n',
                    bech32: 'bc',
                    bip32: {
                        public: 0x04b24746,
                        private: 0x04b2430c
                    },
                    pubKeyHash: 0,
                    scriptHash: 5,
                    wif: 128,
                    bip44: 0x00
                }
            };

            const NATIVE_SEGWIT_TESTNET = {
                label: 'BTC (Bitcoin Testnet, Native SegWit, BIP84)',
                config: {
                    messagePrefix: '\u0018Bitcoin Signed Message:\n',
                    bech32: 'tb',
                    bip32: {
                        public: 0x045f1cf6,
                        private: 0x045f18bc
                    },
                    pubKeyHash: 111,
                    scriptHash: 196,
                    wif: 239,
                    bip44: 0x01
                }
            };

            const nodeBase58Segwit = bip32
                .fromSeed(
                    Buffer.from(entropy, 'hex'),
                    isTestNet ? SEGWIT_TESTNET.config : SEGWIT_MAINNET.config
                )
                .toBase58();

            const nodeBase58NativeSegwit = bip32
                .fromSeed(
                    Buffer.from(entropy, 'hex'),
                    isTestNet
                        ? NATIVE_SEGWIT_TESTNET.config
                        : NATIVE_SEGWIT_MAINNET.config
                )
                .toBase58();

            this.setState({
                loading: false,
                nodeBase58Segwit,
                nodeBase58NativeSegwit
            });
        } catch (e) {
            console.log('Error initializing seed', e);
            this.setState({
                loading: false,
                error: 'Error initializing seed'
            });
        }
    }

    render() {
        const { navigation } = this.props;
        const {
            tab,
            loading,
            nodeBase58Segwit,
            nodeBase58NativeSegwit,
            error
        } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.SeedQRExport.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                {error && <ErrorMessage message={error} />}
                {nodeBase58Segwit && (
                    <ScrollView style={{ margin: 25 }}>
                        <WarningMessage
                            message={localeString(
                                'views.Settings.SeedQRExport.warning'
                            )}
                            fontSize={14}
                        />
                        <Tab
                            value={tab}
                            onChange={(e) =>
                                this.setState({
                                    tab: e
                                })
                            }
                            indicatorStyle={{
                                backgroundColor: themeColor('text'),
                                height: 3
                            }}
                            variant="primary"
                        >
                            <Tab.Item
                                title={localeString('views.Receive.np2wkhKey')}
                                titleStyle={{
                                    ...styles.tabTitleStyle,
                                    color: themeColor('text')
                                }}
                                containerStyle={{
                                    backgroundColor: themeColor('secondary')
                                }}
                            />
                            <Tab.Item
                                title={localeString('views.Receive.p2wkhKey')}
                                titleStyle={{
                                    ...styles.tabTitleStyle,
                                    color: themeColor('text')
                                }}
                                containerStyle={{
                                    backgroundColor: themeColor('secondary')
                                }}
                            />
                        </Tab>
                        <View style={{ marginTop: 25, width: '100%' }}>
                            {tab === 0 && nodeBase58Segwit && (
                                <CollapsedQR
                                    value={nodeBase58Segwit}
                                    expanded
                                />
                            )}
                            {tab === 1 && nodeBase58NativeSegwit && (
                                <CollapsedQR
                                    value={nodeBase58NativeSegwit}
                                    expanded
                                />
                            )}
                        </View>
                    </ScrollView>
                )}
                {loading ? (
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            paddingHorizontal: 15,
                            margin: 50
                        }}
                    >
                        <LoadingIndicator />
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                marginTop: 18,
                                textAlign: 'center'
                            }}
                        >
                            {localeString(
                                'views.Settings.SeedQRExport.pleaseWait'
                            )}
                        </Text>
                    </View>
                ) : (
                    <View
                        style={{
                            alignSelf: 'center',
                            marginTop: 45,
                            bottom: 35,
                            backgroundColor: themeColor('background'),
                            width: '100%'
                        }}
                    >
                        <Button
                            onPress={() => {
                                navigation.popTo('Wallet');
                            }}
                            title={localeString(
                                'views.SendingLightning.goToWallet'
                            )}
                        />
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    tabTitleStyle: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12
    }
});
