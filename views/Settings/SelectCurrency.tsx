import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem, SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

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
    navigation: any;
    SettingsStore: SettingsStore;
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

    async UNSAFE_componentWillMount() {
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
        const result = CURRENCY_KEYS.filter(
            (item: any) =>
                item.key.includes(value) ||
                item.key.toLowerCase().includes(value)
        );
        this.setState({
            search: value,
            currencies: result
        });
    };

    render() {
        const { navigation, SettingsStore } = this.props;
        const { selectedCurrency, search, currencies, fiatRatesSource } =
            this.state;
        const { updateSettings, getSettings }: any = SettingsStore;

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
                        searchIcon={{
                            importantForAccessibility: 'no-hide-descendants',
                            accessibilityElementsHidden: true
                        }}
                    />
                    <FlatList
                        data={currencies.filter((c) =>
                            c.supportedSources?.includes(fiatRatesSource)
                        )}
                        renderItem={({ item }) => (
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                                onPress={async () => {
                                    await updateSettings({
                                        fiat: item.value
                                    }).then(() => {
                                        getSettings();
                                        navigation.navigate('Currency', {
                                            refresh: true
                                        });
                                    });
                                }}
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color:
                                                selectedCurrency ===
                                                    item.value ||
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
                                        item.value === DEFAULT_FIAT)) && (
                                    <View style={{ textAlign: 'right' }}>
                                        <Icon
                                            name="check"
                                            color={themeColor('highlight')}
                                        />
                                    </View>
                                )}
                            </ListItem>
                        )}
                        keyExtractor={(item, index) => `${item.host}-${index}`}
                        ItemSeparatorComponent={this.renderSeparator}
                    />
                </View>
            </Screen>
        );
    }
}
