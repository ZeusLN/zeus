import * as React from 'react';
import { Platform, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { v4 as uuidv4 } from 'uuid';

import { ErrorMessage } from '../../components/SuccessErrorMessage';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import LoadingIndicator from '../../components/LoadingIndicator';
import SeedWordInput from '../../components/SeedWordInput';
import { buttonContainerStyle } from '../../components/seedStyles';

import { restartNeeded } from '../../utils/RestartUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import {
    createLndWallet,
    optimizeNeutrinoPeers,
    stopLnd
} from '../../utils/LndMobileUtils';

import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

interface SeedRecoveryProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    route: Route<'SeedRecovery', { network: string }>;
}

interface SeedRecoveryState {
    loading: boolean;
    network: string;
    seedArray: string[];
    seedPhrase: string[];
    walletPassword: string;
    adminMacaroon: string;
    embeddedLndNetwork: string;
    lndDir: string;
    recoveryCipherSeed: string;
    channelBackupsBase64: string;
    errorMsg: string;
    showSuggestions: boolean;
}

@inject('NodeInfoStore', 'SettingsStore')
@observer
export default class SeedRecovery extends React.PureComponent<
    SeedRecoveryProps,
    SeedRecoveryState
> {
    constructor(props: SeedRecoveryProps) {
        super(props);

        this.state = {
            loading: false,
            network: 'mainnet',
            seedArray: [],
            seedPhrase: [],
            walletPassword: '',
            adminMacaroon: '',
            embeddedLndNetwork: 'mainnet',
            lndDir: '',
            recoveryCipherSeed: '',
            channelBackupsBase64: '',
            errorMsg: '',
            showSuggestions: false
        };
    }

    async componentDidMount() {
        await this.initFromProps(this.props);

        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();

            const seedArray = clipboard.split(' ');
            if (seedArray.length === 24) {
                this.setState({ seedArray });
            }
        }
    }

    async componentDidUpdate(prevProps: SeedRecoveryProps) {
        if (this.props.route.params !== prevProps.route.params) {
            await this.initFromProps(this.props);
        }
    }

    async initFromProps(props: SeedRecoveryProps) {
        const network = props.route.params?.network ?? 'mainnet';
        this.setState({ network });
    }

    saveWalletConfiguration = (recoveryCipherSeed?: string) => {
        const { SettingsStore, navigation } = this.props;
        const {
            walletPassword,
            adminMacaroon,
            embeddedLndNetwork,
            seedPhrase,
            lndDir
        } = this.state;
        const {
            setConnectingStatus,
            updateSettings,
            settings,
            embeddedLndStarted
        } = SettingsStore;

        const node = {
            seedPhrase,
            walletPassword,
            adminMacaroon,
            embeddedLndNetwork,
            implementation: 'embedded-lnd',
            lndDir,
            isSqlite: true
        };

        let nodes: any;
        if (settings.nodes) {
            nodes = settings.nodes || [];
            nodes[nodes.length] = node;
        } else {
            nodes = [node];
        }

        updateSettings({
            nodes,
            selectedNode: nodes.length - 1,
            recovery: recoveryCipherSeed ? true : false
        }).then(async () => {
            if (nodes.length === 1) {
                setConnectingStatus(true);
                navigation.popTo('Wallet');
            } else {
                if (Platform.OS === 'android' && embeddedLndStarted) {
                    restartNeeded(true);
                } else {
                    navigation.popTo('Wallets');
                }
            }
        });
    };

    render() {
        const { navigation } = this.props;
        const {
            loading,
            network,
            seedArray,
            channelBackupsBase64,
            showSuggestions,
            errorMsg
        } = this.state;

        const restore = async () => {
            this.setState({ loading: true });

            await stopLnd();

            await optimizeNeutrinoPeers(network === 'testnet');

            const recoveryCipherSeed = seedArray.join(' ');

            const lndDir = uuidv4();

            try {
                const response = await createLndWallet({
                    lndDir,
                    seedMnemonic: recoveryCipherSeed,
                    isTestnet: network === 'testnet',
                    channelBackupsBase64
                });

                const { wallet, seed, randomBase64 }: any = response;

                if (wallet && wallet.admin_macaroon) {
                    this.setState(
                        {
                            adminMacaroon: wallet.admin_macaroon,
                            seedPhrase: seed.cipher_seed_mnemonic,
                            walletPassword: randomBase64,
                            embeddedLndNetwork:
                                network.charAt(0).toUpperCase() +
                                network.slice(1),
                            lndDir
                        },
                        () => {
                            // Use callback to ensure state is updated before saving
                            this.saveWalletConfiguration(recoveryCipherSeed);
                        }
                    );
                } else {
                    this.setState({
                        loading: false,
                        errorMsg: localeString(
                            'views.Intro.errorCreatingWallet'
                        )
                    });
                }
            } catch (e: any) {
                this.setState({
                    errorMsg: e.toString(),
                    loading: false
                });
            }
        };

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Settings.SeedRecovery.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                {errorMsg && <ErrorMessage message={errorMsg} dismissable />}
                {loading && <LoadingIndicator />}
                {!loading && (
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <SeedWordInput
                            wordCount={24}
                            seedArray={seedArray}
                            onSeedArrayChange={(arr) =>
                                this.setState({ seedArray: arr })
                            }
                            channelBackup={channelBackupsBase64}
                            onChannelBackupChange={(text) =>
                                this.setState({
                                    channelBackupsBase64: text
                                })
                            }
                            onErrorMsgChange={(msg) =>
                                this.setState({ errorMsg: msg })
                            }
                            onShowSuggestionsChange={(showing) =>
                                this.setState({ showSuggestions: showing })
                            }
                        />
                        {!showSuggestions && (
                            <View style={buttonContainerStyle()}>
                                <Button
                                    onPress={() => restore()}
                                    title={
                                        network === 'mainnet'
                                            ? localeString(
                                                  'views.Settings.NodeConfiguration.restoreMainnetWallet'
                                              )
                                            : localeString(
                                                  'views.Settings.NodeConfiguration.restoreTestnetWallet'
                                              )
                                    }
                                    disabled={
                                        seedArray.length !== 24 ||
                                        seedArray.some((seed) => !seed)
                                    }
                                />
                            </View>
                        )}
                    </View>
                )}
            </Screen>
        );
    }
}
