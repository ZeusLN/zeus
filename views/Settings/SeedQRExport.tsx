import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Tab } from 'react-native-elements';

import BIP32Factory from 'bip32';
import ecc from '../../zeus_modules/noble_ecc';

// You must wrap a tiny-secp256k1 compatible implementation
const bip32 = BIP32Factory(ecc);

const aez = require('aez');
const crc32 = require('fast-crc32c/impls/js_crc32c');
const scrypt = require('scrypt-js').scrypt;

import Button from '../../components/Button';
import CollapsedQR from '../../components/CollapsedQR';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import {
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';

import stores from '../../stores/Stores';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';

import { BIP39_WORD_LIST } from '../../utils/Bip39Utils';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import Storage from '../../storage';

interface SeedQRExportProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

interface SeedQRExportState {
    tab: number;
    loading: boolean;
    nodeBase58Segwit: string;
    nodeBase58NativeSegwit: string;
    error: string;
}

const AEZEED_DEFAULT_PASSPHRASE = 'aezeed',
    AEZEED_VERSION = 0,
    SCRYPT_N = 32768,
    SCRYPT_R = 8,
    SCRYPT_P = 1,
    SCRYPT_KEY_LENGTH = 32,
    ENCIPHERED_LENGTH = 33,
    SALT_LENGTH = 5,
    AD_LENGTH = SALT_LENGTH + 1,
    AEZ_TAU = 4,
    CHECKSUM_LENGTH = 4,
    CHECKSUM_OFFSET = ENCIPHERED_LENGTH - CHECKSUM_LENGTH,
    SALT_OFFSET = CHECKSUM_OFFSET - SALT_LENGTH;

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

    lpad(str: string, padString: string, length: number) {
        while (str.length < length) {
            str = padString + str;
        }
        return str;
    }

    getAD(salt: any) {
        const ad = Buffer.alloc(AD_LENGTH, AEZEED_VERSION);
        salt.copy(ad, 1);
        return ad;
    }

    componentDidMount() {
        this.initializeSeed();
    }

    async initializeSeed() {
        try {
            await this.props.SettingsStore.getSettings();
            const { NodeInfoStore, SettingsStore } = this.props;
            const { seedPhrase }: any = SettingsStore;

            const pubkey = NodeInfoStore!.nodeInfo?.nodeId;
            const storageKey = `${pubkey}-extended-private-keys`;
            const extendedKeys = await Storage.getItem(storageKey);
            if (extendedKeys) {
                const extendedKeysJson = JSON.parse(extendedKeys);
                const { nodeBase58Segwit, nodeBase58NativeSegwit } =
                    extendedKeysJson;

                this.setState({
                    loading: false,
                    nodeBase58Segwit,
                    nodeBase58NativeSegwit
                });
                return;
            }

            const bits = seedPhrase
                .map((word: string) => {
                    const index = BIP39_WORD_LIST.indexOf(word);
                    return this.lpad(index.toString(2), '0', 11);
                })
                .join('');

            const seedBytes = bits
                .match(/(.{1,8})/g)
                .map((bin: string) => parseInt(bin, 2));
            const seed = Buffer.from(seedBytes);

            if (!seed || seed.length === 0 || seed[0] !== AEZEED_VERSION) {
                this.setState({
                    loading: false,
                    error: 'Invalid seed or version!'
                });
                return;
            }

            const salt = seed.slice(SALT_OFFSET, SALT_OFFSET + SALT_LENGTH);
            const password = Buffer.from(AEZEED_DEFAULT_PASSPHRASE, 'utf8');
            const cipherSeed = seed.slice(1, SALT_OFFSET);
            const checksum = seed.slice(CHECKSUM_OFFSET);

            const newChecksum = crc32.calculate(seed.slice(0, CHECKSUM_OFFSET));
            if (newChecksum !== checksum.readUInt32BE(0)) {
                this.setState({
                    loading: false,
                    error: 'Invalid seed checksum!'
                });
                return;
            }

            const key = await scrypt(
                password,
                salt,
                SCRYPT_N,
                SCRYPT_R,
                SCRYPT_P,
                SCRYPT_KEY_LENGTH
            );

            const plainSeedBytes = aez.decrypt(
                key,
                null,
                [this.getAD(salt)],
                AEZ_TAU,
                cipherSeed
            );

            if (plainSeedBytes == null) {
                this.setState({
                    loading: false,
                    error: 'Decryption failed. Invalid passphrase?'
                });
                return;
            }

            const entropy = plainSeedBytes.slice(3).toString('hex');

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
                    stores.nodeInfoStore.nodeInfo.isTestNet
                        ? SEGWIT_TESTNET.config
                        : SEGWIT_MAINNET.config
                )
                .toBase58();

            const nodeBase58NativeSegwit = bip32
                .fromSeed(
                    Buffer.from(entropy, 'hex'),
                    stores.nodeInfoStore.nodeInfo.isTestNet
                        ? NATIVE_SEGWIT_TESTNET.config
                        : NATIVE_SEGWIT_MAINNET.config
                )
                .toBase58();

            await Storage.setItem(storageKey, {
                nodeBase58Segwit,
                nodeBase58NativeSegwit
            });

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
