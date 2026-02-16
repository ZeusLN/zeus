import * as React from 'react';
import { FlatList, View, Text } from 'react-native';
import { Icon, ListItem, SearchBar } from '@rneui/themed';
import { inject, observer } from 'mobx-react';

import SettingsStore, {
    CURRENCY_KEYS,
    DEFAULT_FIAT,
    DEFAULT_FIAT_RATES_SOURCE
} from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';
import FiatStore from '../stores/FiatStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { numberWithCommas, numberWithDecimals } from '../utils/UnitsUtils';

import BitcoinIcon from '../assets/images/SVG/bitcoin-icon.svg';

interface CurrencyListProps {
    SettingsStore?: SettingsStore;
    UnitsStore?: UnitsStore;
    FiatStore?: FiatStore;
    onSelect: (currency: string, type: 'unit' | 'fiat') => void;
}

interface CurrencyListState {
    search: string;
    currencies: typeof CURRENCY_KEYS;
}

const BITCOIN_UNITS = [
    { key: 'Satoshis (sats)', value: 'sats' },
    { key: 'Bitcoin (BTC)', value: 'BTC' }
];

@inject('SettingsStore', 'UnitsStore', 'FiatStore')
@observer
export default class CurrencyList extends React.Component<
    CurrencyListProps,
    CurrencyListState
> {
    constructor(props: CurrencyListProps) {
        super(props);
        this.state = {
            search: '',
            currencies: CURRENCY_KEYS
        };
    }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    updateSearch = (value: string) => {
        const result = CURRENCY_KEYS.filter((item: any) => {
            const currencyString = `${item.flag ? item.flag : ''} ${item.key} ${
                item.value ? `(${item.value})` : ''
            }`;
            return currencyString.toLowerCase().includes(value.toLowerCase());
        });
        this.setState({
            search: value,
            currencies: result
        });
    };

    handleSelect = async (value: string, type: 'unit' | 'fiat') => {
        const { SettingsStore, UnitsStore, onSelect } = this.props;

        if (type === 'unit') {
            await UnitsStore!.setUnits(value);
        } else {
            await SettingsStore!.updateSettings({ fiat: value });
            await UnitsStore!.setUnits('fiat');
        }

        onSelect(value, type);
    };

    renderBitcoinUnits = () => {
        const { UnitsStore } = this.props;
        const currentUnit = UnitsStore!.units;

        return (
            <View style={{ marginBottom: 8 }}>
                {BITCOIN_UNITS.map((item, index) => (
                    <React.Fragment key={item.value}>
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: 'transparent'
                            }}
                            onPress={() =>
                                this.handleSelect(item.value, 'unit')
                            }
                        >
                            <View style={{ marginRight: 8 }}>
                                <BitcoinIcon height={20} width={20} />
                            </View>
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color:
                                            currentUnit === item.value
                                                ? themeColor('highlight')
                                                : themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {item.key}
                                </ListItem.Title>
                                {item.value === 'sats' && (
                                    <ListItem.Subtitle
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 12
                                        }}
                                    >
                                        100,000,000 sats = 1 BTC
                                    </ListItem.Subtitle>
                                )}
                            </ListItem.Content>
                            {currentUnit === item.value && (
                                <Icon
                                    name="check"
                                    color={themeColor('highlight')}
                                />
                            )}
                        </ListItem>
                        {index < BITCOIN_UNITS.length - 1 &&
                            this.renderSeparator()}
                    </React.Fragment>
                ))}
            </View>
        );
    };

    render() {
        const { SettingsStore, UnitsStore, FiatStore } = this.props;
        const { search } = this.state;
        const fiatRatesSource =
            SettingsStore!.settings.fiatRatesSource ||
            DEFAULT_FIAT_RATES_SOURCE;
        const currentUnit = UnitsStore!.units;
        const currentFiat = SettingsStore!.settings.fiat || DEFAULT_FIAT;
        const fiatRates = FiatStore?.fiatRates;

        const currencies = [...this.state.currencies]
            .sort((a, b) => a.key.localeCompare(b.key))
            .filter((c) => c.supportedSources?.includes(fiatRatesSource));

        return (
            <View style={{ flex: 1 }}>
                <SearchBar
                    placeholder={localeString('general.search')}
                    onChangeText={this.updateSearch}
                    value={search}
                    inputStyle={{
                        color: themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book'
                    }}
                    placeholderTextColor={themeColor('secondaryText')}
                    containerStyle={{
                        backgroundColor: 'transparent',
                        borderTopWidth: 0,
                        borderBottomWidth: 0
                    }}
                    inputContainerStyle={{
                        borderRadius: 15,
                        backgroundColor: themeColor('secondary')
                    }}
                    autoCorrect={false}
                />

                {!search && this.renderBitcoinUnits()}

                {!search && (
                    <View
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            backgroundColor: themeColor('secondary')
                        }}
                    >
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'PPNeueMontreal-Medium',
                                fontSize: 14
                            }}
                        >
                            {localeString('views.Settings.Currency.title')}
                        </Text>
                    </View>
                )}

                <FlatList
                    data={currencies}
                    renderItem={({ item }) => (
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: 'transparent'
                            }}
                            onPress={() =>
                                this.handleSelect(item.value, 'fiat')
                            }
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color:
                                            currentUnit === 'fiat' &&
                                            currentFiat === item.value
                                                ? themeColor('highlight')
                                                : themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {`${item.flag ? item.flag : ''} ${
                                        item.key
                                    } (${item.value})`}
                                </ListItem.Title>
                                {(() => {
                                    const rateEntry = fiatRates?.find(
                                        (r) => r.code === item.value
                                    );
                                    if (!rateEntry) return null;
                                    const {
                                        symbol,
                                        space,
                                        rtl,
                                        separatorSwap
                                    } = FiatStore!.symbolLookup(item.value);
                                    const formattedRate = separatorSwap
                                        ? numberWithDecimals(rateEntry.rate)
                                        : numberWithCommas(rateEntry.rate);
                                    const rateDisplay = rtl
                                        ? `${formattedRate}${
                                              space ? ' ' : ''
                                          }${symbol} BTC/${item.value}`
                                        : `${symbol}${
                                              space ? ' ' : ''
                                          }${formattedRate} BTC/${item.value}`;
                                    return (
                                        <ListItem.Subtitle
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize: 12
                                            }}
                                        >
                                            {rateDisplay}
                                        </ListItem.Subtitle>
                                    );
                                })()}
                            </ListItem.Content>
                            {currentUnit === 'fiat' &&
                                currentFiat === item.value && (
                                    <Icon
                                        name="check"
                                        color={themeColor('highlight')}
                                    />
                                )}
                        </ListItem>
                    )}
                    keyExtractor={(item) => item.value}
                    ItemSeparatorComponent={this.renderSeparator}
                />
            </View>
        );
    }
}
