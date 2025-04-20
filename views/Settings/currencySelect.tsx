import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem, SearchBar, Text } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import SettingsStore, {
    CURRENCY_KEYS,
    DEFAULT_FIAT,
    DEFAULT_FIAT_RATES_SOURCE
} from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface InvoiceCurrencySelectorProps {
    onCurrencySelect: (currencyValue: string) => void;
    currencyConverter?: boolean;
    SettingsStore: SettingsStore;
}

interface InvoiceCurrencySelectorState {
    selectedCurrency?: string;
    search: string;
    currencies: any[];
    fiatRatesSource: string;
}

@inject('SettingsStore')
@observer
class InvoiceCurrencySelector extends React.Component<
    InvoiceCurrencySelectorProps,
    InvoiceCurrencySelectorState
> {
    constructor(props: InvoiceCurrencySelectorProps) {
        super(props);

        this.state = {
            selectedCurrency: DEFAULT_FIAT,
            search: '',
            currencies: CURRENCY_KEYS,
            fiatRatesSource: DEFAULT_FIAT_RATES_SOURCE
        };
    }

    // async UNSAFE_componentWillMount() {
    //     const { SettingsStore } = this.props;
    //     const { getSettings } = SettingsStore;
    //     const settings = await getSettings();

    //     this.setState({
    //         selectedCurrency: settings.fiat,
    //         fiatRatesSource: settings.fiatRatesSource
    //     });
    // }

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    updateSearch = (value: string) => {
        const result = CURRENCY_KEYS.filter((item: any) =>
            item.key.toLowerCase().includes(value.toLowerCase())
        );
        this.setState({
            search: value,
            currencies: result
        });
    };

    render() {
        const {
            onCurrencySelect,
            currencyConverter = false,
            SettingsStore
        } = this.props;
        const { selectedCurrency, search, fiatRatesSource } = this.state;

        const currencies = this.state.currencies
            .sort((a, b) =>
                a.key
                    .substring(a.key.indexOf(' ') + 1)
                    .localeCompare(b.key.substring(b.key.indexOf(' ') + 1))
            )
            .filter((c) => c.supportedSources?.includes(fiatRatesSource));

        return (
            <View style={{ flex: 1 }}>
                <SearchBar
                    placeholder={localeString('general.search')}
                    // @ts-ignore:next-line
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
                    // @ts-ignore:next-line
                    searchIcon={{
                        importantForAccessibility: 'no-hide-descendants',
                        accessibilityElementsHidden: true
                    }}
                />
                <FlatList
                    data={currencies}
                    keyExtractor={(_, index) => index.toString()}
                    ItemSeparatorComponent={this.renderSeparator}
                    ListEmptyComponent={() => (
                        <Text
                            style={{
                                color: 'gray',
                                textAlign: 'center',
                                marginTop: 40
                            }}
                        >
                            No currencies found.
                        </Text>
                    )}
                    renderItem={({ item }) => (
                        <ListItem
                            containerStyle={{
                                borderBottomWidth: 0,
                                backgroundColor: 'transparent'
                            }}
                            onPress={async () => {
                                if (!SettingsStore) return;
                                if (!currencyConverter) {
                                    await SettingsStore.updateSettings({
                                        fiat: item.value
                                    });
                                    await SettingsStore.getSettings();
                                }
                                onCurrencySelect(item.value);
                            }}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color:
                                            (!currencyConverter &&
                                                selectedCurrency ===
                                                    item.value) ||
                                            (!selectedCurrency &&
                                                item.value === DEFAULT_FIAT)
                                                ? themeColor('highlight')
                                                : themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {item.key}
                                </ListItem.Title>
                            </ListItem.Content>
                            {(selectedCurrency === item.value ||
                                (!selectedCurrency &&
                                    item.value === DEFAULT_FIAT)) &&
                                !currencyConverter && (
                                    <View>
                                        <Icon
                                            name="check"
                                            color={themeColor('highlight')}
                                            style={{ textAlign: 'right' }}
                                        />
                                    </View>
                                )}
                        </ListItem>
                    )}
                />
            </View>
        );
    }
}

export default InvoiceCurrencySelector;
