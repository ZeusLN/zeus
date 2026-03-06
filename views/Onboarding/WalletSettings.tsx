import * as React from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import { Icon, ListItem } from '@rneui/themed';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';

import SettingsStore, {
    CURRENCY_KEYS,
    DEFAULT_FIAT,
    DEFAULT_FIAT_RATES_SOURCE,
    FIAT_RATES_SOURCE_KEYS
} from '../../stores/SettingsStore';

import { createOnboardingWallet } from '../../utils/WalletCreationUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Wordmark from '../../assets/images/SVG/wordmark-black.svg';
import DropdownSetting from '../../components/DropdownSetting';

interface WalletSettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    route: Route<
        'WalletSettings',
        {
            enableCashu: boolean;
            returnTo?: string;
            initialMintUrls?: string[];
            implementation?: string;
        }
    >;
}

interface WalletSettingsState {
    clipboard: boolean;
    fiatEnabled: boolean;
    selectedCurrency: string;
    fiatRatesSource: string;
    choosingPeers: boolean;
    creatingWallet: boolean;
    error: boolean;
}

@inject('SettingsStore')
@observer
export default class WalletSettings extends React.Component<
    WalletSettingsProps,
    WalletSettingsState
> {
    state = {
        clipboard: true,
        fiatEnabled: true,
        selectedCurrency: DEFAULT_FIAT,
        fiatRatesSource: DEFAULT_FIAT_RATES_SOURCE,
        choosingPeers: false,
        creatingWallet: false,
        error: false
    };

    async componentDidMount() {
        const { navigation, SettingsStore } = this.props;
        const settings = await SettingsStore.getSettings();

        this.setState({
            clipboard: settings.privacy?.clipboard ?? true,
            fiatEnabled: settings.fiatEnabled ?? true,
            selectedCurrency: settings.fiat || DEFAULT_FIAT,
            fiatRatesSource:
                settings.fiatRatesSource || DEFAULT_FIAT_RATES_SOURCE
        });

        // Update currency when returning from SelectCurrency
        navigation.addListener('focus', async () => {
            const updatedSettings = await SettingsStore.getSettings();
            if (updatedSettings.fiat !== this.state.selectedCurrency) {
                this.setState({
                    selectedCurrency: updatedSettings.fiat || DEFAULT_FIAT
                });
            }
        });
    }

    handleCreateWallet = async () => {
        const { navigation, SettingsStore, route } = this.props;
        const { clipboard, fiatEnabled, selectedCurrency, fiatRatesSource } =
            this.state;
        const enableCashu = route.params?.enableCashu || false;
        const initialMintUrls = route.params?.initialMintUrls;
        const implementation = route.params?.implementation;

        await createOnboardingWallet({
            settingsStore: SettingsStore,
            enableCashu,
            clipboard,
            fiatEnabled,
            selectedCurrency,
            fiatRatesSource,
            initialMintUrls,
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

    navigateToSelectCurrency = () => {
        this.props.navigation.navigate('SelectCurrency');
    };

    render() {
        const { navigation } = this.props;
        const {
            clipboard,
            fiatEnabled,
            selectedCurrency,
            fiatRatesSource,
            choosingPeers,
            creatingWallet,
            error
        } = this.state;

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

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.WalletSettings.title'),
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

                    <View
                        style={{
                            flexDirection: 'row',
                            marginTop: 20
                        }}
                    >
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontSize: 17,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                                infoModalText={localeString(
                                    'views.Settings.Privacy.clipboard.explainer'
                                ).replace('Zeus', 'ZEUS')}
                            >
                                {localeString(
                                    'views.Settings.Privacy.clipboard'
                                )}
                            </Text>
                        </View>
                        <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                            <Switch
                                value={clipboard}
                                onValueChange={() => {
                                    const newValue = !clipboard;
                                    this.setState({ clipboard: newValue });
                                    this.props.SettingsStore.updateSettings({
                                        privacy: { clipboard: newValue }
                                    });
                                }}
                            />
                        </View>
                    </View>

                    <View
                        style={{
                            marginTop: 30,
                            borderTopWidth: 1,
                            borderTopColor: themeColor('separator'),
                            paddingTop: 20
                        }}
                    >
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: 'transparent',
                                paddingHorizontal: 0
                            }}
                        >
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Currency.enableFiat'
                                )}
                            </ListItem.Title>
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    justifyContent: 'flex-end'
                                }}
                            >
                                <Switch
                                    value={fiatEnabled}
                                    onValueChange={() => {
                                        const newValue = !fiatEnabled;
                                        this.setState({
                                            fiatEnabled: newValue
                                        });
                                        this.props.SettingsStore.updateSettings(
                                            { fiatEnabled: newValue }
                                        );
                                    }}
                                />
                            </View>
                        </ListItem>

                        {fiatEnabled && (
                            <>
                                <DropdownSetting
                                    title={
                                        localeString(
                                            'views.Settings.Currency.source'
                                        ) + ':'
                                    }
                                    selectedValue={fiatRatesSource}
                                    onValueChange={(value: string) => {
                                        this.setState({
                                            fiatRatesSource: value
                                        });
                                        if (
                                            !CURRENCY_KEYS.find(
                                                (c) =>
                                                    c.value === selectedCurrency
                                            )?.supportedSources.includes(value)
                                        ) {
                                            this.setState({
                                                selectedCurrency: DEFAULT_FIAT
                                            });
                                        }
                                    }}
                                    values={FIAT_RATES_SOURCE_KEYS}
                                />

                                <ListItem
                                    containerStyle={{
                                        backgroundColor: 'transparent',
                                        paddingHorizontal: 0
                                    }}
                                    onPress={this.navigateToSelectCurrency}
                                >
                                    <ListItem.Content>
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {(() => {
                                                const currencyInfo =
                                                    CURRENCY_KEYS.find(
                                                        (c) =>
                                                            c.value ===
                                                            selectedCurrency
                                                    );
                                                const flag =
                                                    currencyInfo?.flag || '';
                                                return (
                                                    localeString(
                                                        'views.Settings.Currency.selectCurrency'
                                                    ) +
                                                    ` (${
                                                        flag ? `${flag} ` : ''
                                                    }${selectedCurrency})`
                                                );
                                            })()}
                                        </ListItem.Title>
                                    </ListItem.Content>
                                    <Icon
                                        name="keyboard-arrow-right"
                                        color={themeColor('secondaryText')}
                                    />
                                </ListItem>
                            </>
                        )}
                    </View>

                    <View
                        style={{
                            marginTop: 30,
                            borderTopWidth: 1,
                            borderTopColor: themeColor('separator'),
                            paddingTop: 20
                        }}
                    >
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                paddingHorizontal: 0
                            }}
                            onPress={() => navigation.navigate('Security')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.Security.title'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                    </View>
                </ScrollView>

                <View
                    style={{
                        padding: 20,
                        paddingBottom: 40
                    }}
                >
                    <Button
                        title={localeString(
                            'views.WalletSettings.createWallet'
                        )}
                        onPress={this.handleCreateWallet}
                    />
                </View>
            </Screen>
        );
    }
}
