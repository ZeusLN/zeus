import * as React from 'react';
import { FlatList, TouchableOpacity, View, Text } from 'react-native';
import { Icon, ListItem, SearchBar } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../components/Screen';
import Header from '../../components/Header';

import SettingsStore, {
    CURRENCY_KEYS,
    CURRENCY_CODES_KEY,
    DEFAULT_FIAT,
    DEFAULT_FIAT_RATES_SOURCE
} from '../../stores/SettingsStore';

import Storage from '../../storage';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Star from '../../assets/images/SVG/Star.svg';

interface SelectCurrencyProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    route: Route<
        'SelectCurrency',
        { currencyConverter: boolean; fromModal: boolean }
    >;
}

interface SelectCurrencyState {
    selectedCurrency: string | undefined;
    search: string;
    currencies: any;
    fiatRatesSource: string;
}

@inject('SettingsStore')
@observer
export default class SelectCurrency extends React.Component<
    SelectCurrencyProps,
    SelectCurrencyState
> {
    state = {
        selectedCurrency: DEFAULT_FIAT,
        search: '',
        currencies: CURRENCY_KEYS,
        fiatRatesSource: DEFAULT_FIAT_RATES_SOURCE
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            selectedCurrency: settings.fiat,
            fiatRatesSource: settings.fiatRatesSource
        });

        SettingsStore.loadFavoriteCurrencies();
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

    renderCurrencyItem = (
        item: typeof CURRENCY_KEYS[0],
        isFavorite: boolean
    ) => {
        const { navigation, SettingsStore, route } = this.props;
        const { selectedCurrency } = this.state;
        const { updateSettings, getSettings }: any = SettingsStore;
        const currencyConverter = route.params?.currencyConverter;
        const fromModal = route.params?.fromModal;

        return (
            <ListItem
                containerStyle={{
                    borderBottomWidth: 0,
                    backgroundColor: 'transparent'
                }}
                onPress={async () => {
                    if (currencyConverter && fromModal) {
                        const inputValuesString = await Storage.getItem(
                            CURRENCY_CODES_KEY
                        );
                        const inputValues = inputValuesString
                            ? JSON.parse(inputValuesString)
                            : {};
                        if (!inputValues.hasOwnProperty(item.value)) {
                            inputValues[item.value] = '';
                            await Storage.setItem(
                                CURRENCY_CODES_KEY,
                                inputValues
                            );
                        }
                        navigation.goBack();
                    } else if (currencyConverter) {
                        navigation.popTo('CurrencyConverter', {
                            selectedCurrency: item.value
                        });
                    } else {
                        await updateSettings({
                            fiat: item.value
                        });
                        getSettings();
                        navigation.goBack();
                    }
                }}
            >
                <TouchableOpacity
                    onPress={() =>
                        SettingsStore.toggleFavoriteCurrency(item.value)
                    }
                    style={{ padding: 4 }}
                >
                    <Star
                        fill={isFavorite ? themeColor('text') : 'none'}
                        stroke={isFavorite ? 'none' : themeColor('text')}
                        strokeWidth={2}
                        width={20}
                        height={20}
                    />
                </TouchableOpacity>
                <ListItem.Content>
                    <ListItem.Title
                        style={{
                            color:
                                (!currencyConverter &&
                                    selectedCurrency === item.value) ||
                                (!selectedCurrency &&
                                    item.value === DEFAULT_FIAT)
                                    ? themeColor('highlight')
                                    : themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }}
                    >
                        {`${item.flag ? item.flag : ''} ${item.key} ${
                            item.value ? `(${item.value})` : ''
                        }`}
                    </ListItem.Title>
                </ListItem.Content>
                {(selectedCurrency === item.value ||
                    (!selectedCurrency && item.value === DEFAULT_FIAT)) &&
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
        );
    };

    renderFavorites = (favoriteCurrencyItems: typeof CURRENCY_KEYS[0][]) => {
        if (favoriteCurrencyItems.length === 0) return null;

        return (
            <>
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
                        {localeString('views.Settings.Contacts.favorites')}
                    </Text>
                </View>
                <View style={{ marginBottom: 8 }}>
                    {favoriteCurrencyItems.map((item, index) => (
                        <React.Fragment key={`fav-${item.value}`}>
                            {this.renderCurrencyItem(item, true)}
                            {index < favoriteCurrencyItems.length - 1 &&
                                this.renderSeparator()}
                        </React.Fragment>
                    ))}
                </View>
            </>
        );
    };

    render() {
        const { navigation, SettingsStore, route } = this.props;
        const { search, fiatRatesSource } = this.state;
        const favoriteCurrencies = SettingsStore.favoriteCurrencies;

        const currencies = this.state.currencies
            .sort((a, b) => a.key.localeCompare(b.key))
            .filter((c) => c.supportedSources?.includes(fiatRatesSource));

        const currencyConverter = route.params?.currencyConverter;

        const favoriteCurrencyItems = currencies.filter((c) =>
            favoriteCurrencies.includes(c.value)
        );
        const nonFavoriteCurrencyItems = currencies.filter(
            (c) => !favoriteCurrencies.includes(c.value)
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: `${localeString(
                                'views.Settings.SelectCurrency.title'
                            )} (${currencies?.length || 0})`,
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
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
                        autoCorrect={false}
                    />
                    <FlatList
                        data={search ? currencies : nonFavoriteCurrencyItems}
                        renderItem={({ item }) =>
                            this.renderCurrencyItem(
                                item,
                                favoriteCurrencies.includes(item.value)
                            )
                        }
                        keyExtractor={(item) => item.value}
                        ItemSeparatorComponent={this.renderSeparator}
                        ListHeaderComponent={
                            !search ? (
                                <>
                                    {this.renderFavorites(
                                        favoriteCurrencyItems
                                    )}
                                    {!currencyConverter &&
                                        favoriteCurrencyItems.length > 0 && (
                                            <View
                                                style={{
                                                    paddingHorizontal: 16,
                                                    paddingVertical: 8,
                                                    backgroundColor:
                                                        themeColor('secondary')
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: themeColor(
                                                            'secondaryText'
                                                        ),
                                                        fontFamily:
                                                            'PPNeueMontreal-Medium',
                                                        fontSize: 14
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.Settings.Currency.otherCurrencies'
                                                    )}
                                                </Text>
                                            </View>
                                        )}
                                </>
                            ) : undefined
                        }
                    />
                </View>
            </Screen>
        );
    }
}
