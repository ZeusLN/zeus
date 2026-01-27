import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem, SearchBar } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../components/Screen';
import Header from '../../components/Header';

import SettingsStore, {
    CURRENCY_KEYS,
    DEFAULT_FIAT,
    DEFAULT_FIAT_RATES_SOURCE
} from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface SelectCurrencyProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    route: Route<'SelectCurrency', { currencyConverter: boolean }>;
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

    render() {
        const { navigation, SettingsStore, route } = this.props;
        const { search, fiatRatesSource } = this.state;
        const currencies = this.state.currencies
            .sort((a, b) => a.key.localeCompare(b.key))
            .filter((c) => c.supportedSources?.includes(fiatRatesSource));

        const { updateSettings, getSettings }: any = SettingsStore;

        const currencyConverter = route.params?.currencyConverter;

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
                        data={currencies}
                        renderItem={({ item }) => (
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                                onPress={async () => {
                                    if (currencyConverter) {
                                        navigation.popTo('CurrencyConverter', {
                                            selectedCurrency: item.value
                                        });
                                    } else {
                                        let newFiats = [
                                            ...SettingsStore.settings.fiats
                                        ];
                                        if (newFiats.includes(item.value)) {
                                            if (newFiats.length > 1) {
                                                newFiats = newFiats.filter(
                                                    (f) => f !== item.value
                                                );
                                            }
                                        } else {
                                            newFiats.push(item.value);
                                        }

                                        // fiat is auto-synced via updateSettings
                                        await updateSettings({
                                            fiats: newFiats
                                        }).then(() => {
                                            getSettings();
                                        });
                                    }
                                }}
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color:
                                                (!currencyConverter &&
                                                    SettingsStore.settings.fiats.includes(
                                                        item.value
                                                    )) ||
                                                (!SettingsStore.settings
                                                    .fiats &&
                                                    item.value === DEFAULT_FIAT)
                                                    ? themeColor('highlight')
                                                    : themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {`${item.flag ? item.flag : ''} ${
                                            item.key
                                        } ${
                                            item.value ? `(${item.value})` : ''
                                        }`}
                                    </ListItem.Title>
                                </ListItem.Content>
                                {(SettingsStore.settings.fiats.includes(
                                    item.value
                                ) ||
                                    (!SettingsStore.settings.fiats &&
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
                        keyExtractor={(_, index) => index.toString()}
                        ItemSeparatorComponent={this.renderSeparator}
                    />
                </View>
            </Screen>
        );
    }
}
