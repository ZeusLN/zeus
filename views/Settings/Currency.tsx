import * as React from 'react';
import { FlatList, View } from 'react-native';
import { Icon, ListItem, SearchBar } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Screen from '../../components/Screen';
import Header from '../../components/Header';

import UnitsStore from '../../stores/UnitsStore';
import SettingsStore, {
    CURRENCY_KEYS,
    DEFAULT_FIAT,
    DEFAULT_FIAT_RATES_SOURCE,
    FIAT_RATES_SOURCE_KEYS
} from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import DropdownSetting from '../../components/DropdownSetting';

interface CurrencyProps {
    navigation: any;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

interface CurrencyState {
    selectCurrency: string;
    search: string;
    currencies: any;
    fiatRatesSource: string;
}

@inject('SettingsStore', 'UnitsStore')
@observer
export default class Currency extends React.Component<
    CurrencyProps,
    CurrencyState
> {
    state = {
        selectedCurrency: '',
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
        const { navigation, SettingsStore, UnitsStore } = this.props;
        const { selectedCurrency, search, currencies, fiatRatesSource } =
            this.state;
        const { updateSettings, getSettings }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Settings.Currency.title'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={{ marginHorizontal: 8 }}>
                        <DropdownSetting
                            title={
                                localeString('views.Settings.Currency.source') +
                                ':'
                            }
                            selectedValue={fiatRatesSource}
                            onValueChange={async (value: string) => {
                                this.setState({ fiatRatesSource: value });
                                const newSettings: any = {
                                    fiatRatesSource: value
                                };
                                if (
                                    !currencies
                                        .find(
                                            (c) => c.value === selectedCurrency
                                        )
                                        ?.supportedSources.includes(value)
                                ) {
                                    newSettings.fiat = DEFAULT_FIAT;
                                    this.setState({
                                        selectedCurrency: DEFAULT_FIAT
                                    });
                                }
                                await updateSettings(newSettings);
                            }}
                            values={FIAT_RATES_SOURCE_KEYS}
                            titlePosition="left"
                        />
                    </View>
                    <SearchBar
                        placeholder={localeString('general.search')}
                        onChangeText={this.updateSearch}
                        value={search}
                        inputStyle={{
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
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
                                        UnitsStore.resetUnits();
                                        getSettings();
                                        navigation.navigate('Settings', {
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
                                                    item.value === 'Disabled')
                                                    ? themeColor('highlight')
                                                    : themeColor('text'),
                                            fontFamily: 'Lato-Regular'
                                        }}
                                    >
                                        {item.key}
                                    </ListItem.Title>
                                </ListItem.Content>
                                {(selectedCurrency === item.value ||
                                    (!selectedCurrency &&
                                        item.value === 'Disabled')) && (
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
