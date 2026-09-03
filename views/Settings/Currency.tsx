import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Screen from '../../components/Screen';
import Header from '../../components/Header';

import SettingsStore, {
    CURRENCY_KEYS,
    DEFAULT_FIAT,
    DEFAULT_FIAT_RATES_SOURCE,
    FIAT_RATES_SOURCE_KEYS,
    isCurrencySupportedBySource
} from '../../stores/SettingsStore';

import UnitsStore from '../../stores/UnitsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';
import DropdownSetting from '../../components/DropdownSetting';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

interface CurrencyProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

interface CurrencyState {
    fiatEnabled: boolean | undefined;
    selectedCurrency: string | undefined;
    fiatRatesSource: string;
    btcPayServerHost: string;
    btcPayServerStoreId: string;
}

@inject('SettingsStore', 'UnitsStore')
@observer
export default class Currency extends React.Component<
    CurrencyProps,
    CurrencyState
> {
    state = {
        fiatEnabled: this.props.SettingsStore.settings.fiatEnabled || false,
        selectedCurrency: this.props.SettingsStore.settings.fiat || '',
        fiatRatesSource:
            this.props.SettingsStore.settings.fiatRatesSource ??
            DEFAULT_FIAT_RATES_SOURCE,
        btcPayServerHost:
            this.props.SettingsStore.settings.btcPayServerHost || '',
        btcPayServerStoreId:
            this.props.SettingsStore.settings.btcPayServerStoreId || ''
    };

    componentWillUnmount() {
        // 'BTCPay Server' with incomplete config can never return a rate,
        // so leaving it selected would misrepresent the source actually in
        // use. Revert the dropdown on the way out.
        const { settings, updateSettings }: any = this.props.SettingsStore;
        if (
            settings.fiatRatesSource === 'BTCPayServer' &&
            (!(settings.btcPayServerHost || '').trim() ||
                !(settings.btcPayServerStoreId || '').trim())
        ) {
            const updates: any = {
                fiatRatesSource: DEFAULT_FIAT_RATES_SOURCE
            };
            if (
                !isCurrencySupportedBySource(
                    CURRENCY_KEYS.find((c) => c.value === settings.fiat),
                    DEFAULT_FIAT_RATES_SOURCE
                )
            ) {
                updates.fiat = DEFAULT_FIAT;
            }
            updateSettings(updates);
        }
    }

    // Requires a full http(s) URL, matching the other custom server settings
    isValidHost = (text: string): boolean => {
        const trimmed = text.trim();
        return trimmed === '' || UrlUtils.isValidUrl(trimmed);
    };

    async componentDidUpdate(
        _prevProps: Readonly<CurrencyProps>,
        prevState: Readonly<CurrencyState>,
        _snapshot?: any
    ): Promise<void> {
        const { settings } = this.props.SettingsStore;
        if (prevState.selectedCurrency !== settings.fiat) {
            this.setState({
                selectedCurrency: settings.fiat
            });
        }
    }

    navigateToSelectCurrency = () => {
        this.props.navigation.navigate('SelectCurrency');
    };

    render() {
        const { navigation, SettingsStore, UnitsStore } = this.props;
        const {
            fiatEnabled,
            selectedCurrency,
            fiatRatesSource,
            btcPayServerHost,
            btcPayServerStoreId
        } = this.state;
        const { updateSettings }: any = SettingsStore;

        const btcPayServerHostError = !this.isValidHost(btcPayServerHost);

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Settings.Currency.title'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView keyboardShouldPersistTaps="handled">
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: 'transparent'
                            }}
                        >
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString('general.enabled')}
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
                                    onValueChange={async () => {
                                        const newFiatEnabled = !fiatEnabled;
                                        this.setState({
                                            fiatEnabled: newFiatEnabled
                                        });
                                        await updateSettings({
                                            fiatEnabled: newFiatEnabled
                                        });
                                        if (!newFiatEnabled) {
                                            if (UnitsStore.units === 'fiat') {
                                                UnitsStore.resetUnits();
                                            }
                                        }
                                    }}
                                />
                            </View>
                        </ListItem>
                        {fiatEnabled && (
                            <>
                                <View style={{ marginHorizontal: 16 }}>
                                    <DropdownSetting
                                        title={
                                            localeString(
                                                'views.Settings.Currency.source'
                                            ) + ':'
                                        }
                                        selectedValue={fiatRatesSource}
                                        onValueChange={async (
                                            value: string
                                        ) => {
                                            this.setState({
                                                fiatRatesSource: value
                                            });
                                            const newSettings: any = {
                                                fiatRatesSource: value
                                            };
                                            if (
                                                !isCurrencySupportedBySource(
                                                    CURRENCY_KEYS.find(
                                                        (c) =>
                                                            c.value ===
                                                            selectedCurrency
                                                    ),
                                                    value
                                                )
                                            ) {
                                                newSettings.fiat = DEFAULT_FIAT;
                                                this.setState({
                                                    selectedCurrency:
                                                        DEFAULT_FIAT
                                                });
                                            }
                                            await updateSettings(newSettings);
                                        }}
                                        values={FIAT_RATES_SOURCE_KEYS}
                                    />
                                    {fiatRatesSource === 'BTCPayServer' && (
                                        <>
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book'
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.Currency.btcPayServerHost'
                                                )}
                                            </Text>
                                            <TextInput
                                                value={btcPayServerHost}
                                                placeholder="https://btcpay.mynode.local"
                                                error={btcPayServerHostError}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                onChangeText={async (
                                                    text: string
                                                ) => {
                                                    this.setState({
                                                        btcPayServerHost: text
                                                    });

                                                    if (!this.isValidHost(text))
                                                        return;

                                                    await updateSettings({
                                                        btcPayServerHost: text
                                                    });
                                                }}
                                            />
                                            {btcPayServerHostError && (
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'error'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Book',
                                                        fontSize: 12,
                                                        marginTop: 4
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.Settings.Privacy.invalidCustomUrl'
                                                    )}
                                                </Text>
                                            )}
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book'
                                                }}
                                            >
                                                {localeString(
                                                    'views.Settings.Currency.btcPayServerStoreId'
                                                )}
                                            </Text>
                                            <TextInput
                                                value={btcPayServerStoreId}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                onChangeText={async (
                                                    text: string
                                                ) => {
                                                    this.setState({
                                                        btcPayServerStoreId:
                                                            text
                                                    });

                                                    await updateSettings({
                                                        btcPayServerStoreId:
                                                            text
                                                    });
                                                }}
                                            />
                                        </>
                                    )}
                                </View>
                                <ListItem
                                    containerStyle={{
                                        backgroundColor: 'transparent'
                                    }}
                                    onPress={() =>
                                        this.navigateToSelectCurrency()
                                    }
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
                                            {localeString(
                                                'views.Settings.Currency.selectCurrency'
                                            ) + ` (${selectedCurrency})`}
                                        </ListItem.Title>
                                    </ListItem.Content>
                                    <Icon
                                        name="keyboard-arrow-right"
                                        color={themeColor('secondaryText')}
                                    />
                                </ListItem>
                                <ListItem
                                    containerStyle={{
                                        backgroundColor: 'transparent'
                                    }}
                                    onPress={() =>
                                        navigation.navigate('CurrencyConverter')
                                    }
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
                                            {localeString(
                                                'views.Settings.CurrencyConverter.title'
                                            )}
                                        </ListItem.Title>
                                    </ListItem.Content>
                                    <Icon
                                        name="keyboard-arrow-right"
                                        color={themeColor('secondaryText')}
                                    />
                                </ListItem>
                            </>
                        )}
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
