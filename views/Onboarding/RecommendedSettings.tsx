import * as React from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Route } from '@react-navigation/native';
import { Icon, ListItem } from '@rneui/themed';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Text from '../../components/Text';

import CashuStore, { ScoredMint } from '../../stores/CashuStore';
import SettingsStore, {
    CURRENCY_KEYS,
    DEFAULT_FIAT,
    DEFAULT_FIAT_RATES_SOURCE
} from '../../stores/SettingsStore';

import { createOnboardingWallet } from '../../utils/WalletCreationUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import MintAvatar from '../../components/MintAvatar';
import Wordmark from '../../assets/images/SVG/wordmark-black.svg';

type DiscoverMode = 'zeus' | 'all' | 'custom' | 'later';

interface RecommendedSettingsProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    CashuStore: CashuStore;
    route: Route<
        'RecommendedSettings',
        {
            enableCashu?: boolean;
            discoverMode?: DiscoverMode;
            initialMintUrls?: string[];
            clipboard?: boolean;
            fiatEnabled?: boolean;
            selectedCurrency?: string;
            fiatRatesSource?: string;
            implementation?: string;
        }
    >;
}

interface RecommendedSettingsState {
    enableCashu: boolean;
    discoverMode: DiscoverMode;
    clipboard: boolean;
    fiatEnabled: boolean;
    selectedCurrency: string;
    fiatRatesSource: string;
    initialMintUrls: string[];
    implementation: string;
    choosingPeers: boolean;
    creatingWallet: boolean;
    error: boolean;
}

@inject('SettingsStore', 'CashuStore')
@observer
export default class RecommendedSettings extends React.Component<
    RecommendedSettingsProps,
    RecommendedSettingsState
> {
    state: RecommendedSettingsState = {
        enableCashu: true,
        discoverMode: 'zeus',
        clipboard: true,
        fiatEnabled: true,
        selectedCurrency: DEFAULT_FIAT,
        fiatRatesSource: DEFAULT_FIAT_RATES_SOURCE,
        initialMintUrls: [],
        implementation: 'ldk-node',
        choosingPeers: false,
        creatingWallet: false,
        error: false
    };

    componentDidMount() {
        const { navigation, CashuStore, SettingsStore } = this.props;

        // Fetch mints with default mode (ZEUS' contacts)
        CashuStore.fetchMintsFromFollows();

        // Listen for updates when returning from questionnaire steps
        navigation.addListener('focus', async () => {
            this.syncFromRouteParams();

            // Sync settings saved to the store by sub-screens
            const settings = await SettingsStore.getSettings();
            this.setState({
                clipboard: settings.privacy?.clipboard ?? true,
                fiatEnabled: settings.fiatEnabled ?? true,
                selectedCurrency: settings.fiat || DEFAULT_FIAT,
                fiatRatesSource:
                    settings.fiatRatesSource || DEFAULT_FIAT_RATES_SOURCE
            });
        });
    }

    syncFromRouteParams = () => {
        const { route } = this.props;
        const params = route.params;
        if (!params) return;

        if (params.enableCashu !== undefined) {
            this.setState({ enableCashu: params.enableCashu });
        }
        if (params.discoverMode) {
            this.setState({ discoverMode: params.discoverMode });
        }
        if (params.initialMintUrls) {
            this.setState({ initialMintUrls: params.initialMintUrls });
        }
        if (params.clipboard !== undefined) {
            this.setState({ clipboard: params.clipboard });
        }
        if (params.fiatEnabled !== undefined) {
            this.setState({ fiatEnabled: params.fiatEnabled });
        }
        if (params.selectedCurrency) {
            this.setState({ selectedCurrency: params.selectedCurrency });
        }
        if (params.fiatRatesSource) {
            this.setState({ fiatRatesSource: params.fiatRatesSource });
        }
        if (params.implementation) {
            this.setState({ implementation: params.implementation });
        }
    };

    handleCreateWallet = async () => {
        const { navigation, SettingsStore, CashuStore } = this.props;
        const {
            enableCashu,
            discoverMode,
            clipboard,
            fiatEnabled,
            selectedCurrency,
            fiatRatesSource,
            initialMintUrls,
            implementation
        } = this.state;

        // Use stored mint URLs or compute from top scored mints
        let mintUrls = initialMintUrls;
        if (enableCashu && mintUrls.length === 0) {
            const topMints = CashuStore.getTopScoredMints(
                5,
                discoverMode === 'all' ? 'all' : 'zeus'
            );
            mintUrls = topMints.map((m: ScoredMint) => m.url);
        }

        await createOnboardingWallet({
            settingsStore: SettingsStore,
            enableCashu,
            clipboard,
            fiatEnabled,
            selectedCurrency,
            fiatRatesSource,
            initialMintUrls: enableCashu ? mintUrls : undefined,
            implementation,
            onChoosingPeers: () =>
                this.setState({ choosingPeers: true, error: false }),
            onCreatingWallet: () =>
                this.setState({
                    choosingPeers: false,
                    creatingWallet: true
                }),
            onError: () =>
                this.setState({
                    error: true,
                    choosingPeers: false,
                    creatingWallet: false
                }),
            onSuccess: () => navigation.navigate('Wallet')
        });
    };

    getMintSourceLabel = () => {
        const { discoverMode } = this.state;
        switch (discoverMode) {
            case 'zeus':
                return localeString('views.Cashu.AddMint.zeusFollows');
            case 'all':
                return localeString('views.Cashu.AddMint.allNostrUsers');
            case 'custom':
                return localeString('views.Cashu.AddMint.yourFollows');
            case 'later':
                return localeString('views.MintDiscovery.chooseLater');
        }
    };

    render() {
        const { navigation, CashuStore } = this.props;
        const {
            enableCashu,
            discoverMode,
            clipboard,
            fiatEnabled,
            selectedCurrency,
            implementation,
            choosingPeers,
            creatingWallet,
            error
        } = this.state;

        const currencyInfo = CURRENCY_KEYS.find(
            (c) => c.value === selectedCurrency
        );
        const currencyFlag = currencyInfo?.flag || '';
        const currencyLabel = currencyFlag
            ? `${currencyFlag} ${selectedCurrency}`
            : selectedCurrency;

        if (choosingPeers || creatingWallet) {
            return (
                <Screen>
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'center',
                            alignItems: 'center',
                            top: 10
                        }}
                    >
                        <View
                            style={{
                                width: Dimensions.get('window').width * 0.85,
                                maxHeight: 200,
                                marginTop: 10,
                                alignSelf: 'center'
                            }}
                        >
                            <Wordmark fill={themeColor('highlight')} />
                        </View>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Book',
                                alignSelf: 'center',
                                fontSize: 15,
                                padding: 8
                            }}
                        >
                            {choosingPeers
                                ? localeString('views.Intro.choosingPeers')
                                : localeString(
                                      'views.Intro.creatingWallet'
                                  ).replace('Zeus', 'ZEUS')}
                        </Text>
                        <View style={{ marginTop: 40 }}>
                            <LoadingIndicator />
                        </View>
                    </View>
                </Screen>
            );
        }

        const isLater = discoverMode === 'later';

        const isLoadingMints = isLater
            ? false
            : discoverMode === 'all'
            ? CashuStore.loading
            : CashuStore.loadingTrustedMints;

        const topMints =
            enableCashu && !isLater
                ? CashuStore.getTopScoredMints(
                      5,
                      discoverMode === 'all' ? 'all' : 'zeus'
                  )
                : [];

        // Fetch mint info for icons when top mints are available
        if (topMints.length > 0 && !isLoadingMints) {
            const urls = topMints.map((m: ScoredMint) => m.url);
            const hasUncached = urls.some(
                (u: string) => !CashuStore.mintInfoCache.has(u)
            );
            if (hasUncached) {
                CashuStore.fetchMintInfoBatch(urls);
            }
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.RecommendedSettings.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{ flex: 1, paddingHorizontal: 15, marginTop: 5 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {error && (
                        <View
                            style={{
                                backgroundColor: themeColor('error'),
                                padding: 15,
                                borderRadius: 5,
                                marginBottom: 15
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    textAlign: 'center'
                                }}
                            >
                                {localeString(
                                    'views.Intro.errorCreatingWallet'
                                )}
                            </Text>
                        </View>
                    )}

                    {/* Wallet type */}
                    <ListItem
                        containerStyle={{
                            backgroundColor: 'transparent',
                            paddingHorizontal: 0,
                            marginTop: 10
                        }}
                        onPress={() =>
                            navigation.navigate('WalletType', {
                                returnTo: 'RecommendedSettings'
                            })
                        }
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.RecommendedSettings.walletType'
                                )}
                            </ListItem.Title>
                            <ListItem.Subtitle
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    marginTop: 4
                                }}
                            >
                                {enableCashu
                                    ? localeString(
                                          'views.RecommendedSettings.walletType.cashu'
                                      )
                                    : localeString(
                                          'views.RecommendedSettings.walletType.selfCustody'
                                      )}
                            </ListItem.Subtitle>
                            {enableCashu && (
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 12,
                                        marginTop: 2
                                    }}
                                >
                                    {localeString(
                                        'views.RecommendedSettings.walletType.subtitle'
                                    )}
                                </Text>
                            )}
                        </ListItem.Content>
                        <Icon
                            name="keyboard-arrow-right"
                            color={themeColor('secondaryText')}
                        />
                    </ListItem>

                    {/* Node implementation */}
                    <ListItem
                        containerStyle={{
                            backgroundColor: 'transparent',
                            paddingHorizontal: 0,
                            borderTopWidth: 1,
                            borderTopColor: themeColor('separator')
                        }}
                        onPress={() =>
                            navigation.navigate('NodeChoice', {
                                returnTo: 'RecommendedSettings',
                                enableCashu
                            })
                        }
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.RecommendedSettings.nodeImplementation'
                                )}
                            </ListItem.Title>
                            <ListItem.Subtitle
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    marginTop: 4
                                }}
                            >
                                {implementation === 'ldk-node'
                                    ? `LDK Node (${localeString(
                                          'views.NodeChoice.speedReliability'
                                      ).toLowerCase()})`
                                    : `Embedded LND (${localeString(
                                          'views.NodeChoice.privacyPower'
                                      ).toLowerCase()})`}
                            </ListItem.Subtitle>
                        </ListItem.Content>
                        <Icon
                            name="keyboard-arrow-right"
                            color={themeColor('secondaryText')}
                        />
                    </ListItem>

                    {/* Mint source (only when ecash enabled) */}
                    {enableCashu && (
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                paddingHorizontal: 0,
                                borderTopWidth: 1,
                                borderTopColor: themeColor('separator')
                            }}
                            onPress={() =>
                                navigation.navigate('MintDiscovery', {
                                    returnTo: 'RecommendedSettings',
                                    enableCashu: true
                                })
                            }
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.RecommendedSettings.mintSource'
                                    )}
                                </ListItem.Title>
                                <ListItem.Subtitle
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Medium',
                                        marginTop: 4
                                    }}
                                >
                                    {this.getMintSourceLabel()}
                                </ListItem.Subtitle>
                                {isLoadingMints ? (
                                    <View
                                        style={{
                                            marginTop: 10,
                                            height: 36,
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <LoadingIndicator size={24} />
                                    </View>
                                ) : topMints.length > 0 ? (
                                    <View
                                        style={{
                                            flexDirection: 'row',
                                            marginTop: 10,
                                            gap: 8
                                        }}
                                    >
                                        {topMints.map((mint: ScoredMint) => {
                                            const mintInfo =
                                                CashuStore.mintInfoCache.get(
                                                    mint.url
                                                );
                                            return (
                                                <MintAvatar
                                                    key={mint.url}
                                                    iconUrl={mintInfo?.icon_url}
                                                    name={
                                                        mintInfo?.name ||
                                                        mint.url
                                                    }
                                                    size="medium"
                                                    style={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: 18
                                                    }}
                                                />
                                            );
                                        })}
                                    </View>
                                ) : null}
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                    )}

                    {/* Clipboard */}
                    <ListItem
                        containerStyle={{
                            backgroundColor: 'transparent',
                            paddingHorizontal: 0,
                            borderTopWidth: 1,
                            borderTopColor: themeColor('separator')
                        }}
                        onPress={() =>
                            navigation.navigate('WalletSettings', {
                                returnTo: 'RecommendedSettings',
                                enableCashu
                            })
                        }
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.RecommendedSettings.clipboard'
                                )}
                            </ListItem.Title>
                            <ListItem.Subtitle
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    marginTop: 4
                                }}
                            >
                                {clipboard
                                    ? localeString(
                                          'views.Settings.Privacy.clipboard'
                                      )
                                    : localeString(
                                          'views.RecommendedSettings.off'
                                      )}
                            </ListItem.Subtitle>
                        </ListItem.Content>
                        <Icon
                            name="keyboard-arrow-right"
                            color={themeColor('secondaryText')}
                        />
                    </ListItem>

                    {/* Fiat */}
                    <ListItem
                        containerStyle={{
                            backgroundColor: 'transparent',
                            paddingHorizontal: 0,
                            borderTopWidth: 1,
                            borderTopColor: themeColor('separator')
                        }}
                        onPress={() =>
                            navigation.navigate('WalletSettings', {
                                returnTo: 'RecommendedSettings',
                                enableCashu
                            })
                        }
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString('views.RecommendedSettings.fiat')}
                            </ListItem.Title>
                            <ListItem.Subtitle
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Medium',
                                    marginTop: 4
                                }}
                            >
                                {fiatEnabled
                                    ? currencyLabel
                                    : localeString(
                                          'views.RecommendedSettings.disabled'
                                      )}
                            </ListItem.Subtitle>
                        </ListItem.Content>
                        <Icon
                            name="keyboard-arrow-right"
                            color={themeColor('secondaryText')}
                        />
                    </ListItem>
                </ScrollView>

                <View
                    style={{
                        padding: 20,
                        paddingBottom: 40
                    }}
                >
                    <Button
                        title={localeString(
                            'views.RecommendedSettings.createWallet'
                        )}
                        onPress={this.handleCreateWallet}
                        disabled={isLoadingMints}
                    />
                </View>
            </Screen>
        );
    }
}
