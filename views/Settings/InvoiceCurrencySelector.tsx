import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem, SearchBar, Text } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { computed, observable } from 'mobx';

import SettingsStore, {
    CURRENCY_KEYS,
    DEFAULT_FIAT
} from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface InvoiceCurrencySelectorProps {
    onCurrencySelect: (currencyValue: string) => void;
    currencyConverter?: boolean;
    SettingsStore?: SettingsStore;
    selectedValue?: string;
}

interface InvoiceCurrencySelectorState {
    search: string;
}

@inject('SettingsStore')
@observer
class InvoiceCurrencySelector extends React.Component<
    InvoiceCurrencySelectorProps,
    InvoiceCurrencySelectorState
> {
    @observable search: string = '';

    @computed get filteredCurrencies() {
        const fiatRatesSource =
            this.props.SettingsStore?.settings?.fiatRatesSource;
        if (!fiatRatesSource) {
            return [];
        }

        const sourceFiltered = CURRENCY_KEYS.filter((c) =>
            c.supportedSources?.includes(fiatRatesSource)
        );

        const searchFiltered = this.search
            ? sourceFiltered.filter((item: any) =>
                  item.key.toLowerCase().includes(this.search.toLowerCase())
              )
            : sourceFiltered;

        return searchFiltered.sort((a, b) =>
            a.key
                .substring(a.key.indexOf(' ') + 1)
                .localeCompare(b.key.substring(b.key.indexOf(' ') + 1))
        );
    }

    constructor(props: InvoiceCurrencySelectorProps) {
        super(props);
        observable(this);

        this.state = {
            search: ''
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

    updateSearch = (...args: any[]) => {
        const value = args[0] as string;
        this.search = value;
    };

    render() {
        const {
            onCurrencySelect,
            currencyConverter = false,
            SettingsStore
        } = this.props;

        const currenciesToRender = this.filteredCurrencies;

        return (
            <View style={{ flex: 1 }}>
                <SearchBar
                    placeholder={localeString('general.search')}
                    onChangeText={this.updateSearch}
                    value={this.search}
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
                    data={currenciesToRender}
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
                            {localeString(
                                'views.Settings.Currency.noCurrenciesFound'
                            )}
                        </Text>
                    )}
                    renderItem={({ item }) => {
                        const globalSelectedCurrency =
                            SettingsStore?.settings?.fiat ?? DEFAULT_FIAT;
                        const currencyToCompare = currencyConverter
                            ? this.props.selectedValue
                            : globalSelectedCurrency;

                        const isSelected = currencyToCompare === item.value;

                        return (
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                                onPress={async () => {
                                    if (!currencyConverter) {
                                        await SettingsStore?.updateSettings({
                                            fiat: item.value
                                        });
                                    }
                                    onCurrencySelect(item.value);
                                }}
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color: isSelected
                                                ? themeColor('highlight')
                                                : themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {item.key}
                                    </ListItem.Title>
                                </ListItem.Content>
                                {isSelected && currencyConverter && (
                                    <View>
                                        <Icon
                                            name="check"
                                            color={themeColor('highlight')}
                                            style={{ textAlign: 'right' }}
                                        />
                                    </View>
                                )}
                            </ListItem>
                        );
                    }}
                />
            </View>
        );
    }
}

export default InvoiceCurrencySelector;
