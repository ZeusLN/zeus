import * as React from 'react';
import { SearchBar } from 'react-native-elements';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { themeColor } from '../../utils/ThemeUtils';

import { FlatList, Text, TouchableOpacity, View } from 'react-native';

import { CURRENCY_KEYS } from '../../stores/SettingsStore';
import { localeString } from '../../utils/LocaleUtils';

interface AddCurrenciesProps {
    navigation: any;
}

interface AddCurrenciesState {
    search: string;
}

export default class AddCurrencies extends React.Component<
    AddCurrenciesProps,
    AddCurrenciesState
> {
    constructor(props: AddCurrenciesProps) {
        super(props);
        this.state = {
            search: ''
        };
    }

    updateSearch = (query: string) => {
        this.setState({ search: query });
    };

    renderSeparator = () => (
        <View
            style={{
                height: 1,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    render() {
        const { navigation } = this.props;

        const updatedCurrencyList = [
            {
                key: '฿ Bitcoin (BTC)',
                value: 'BTC'
            },
            {
                key: '฿ Satoshis (SAT)',
                value: 'SAT'
            },
            ...CURRENCY_KEYS
        ];

        const { search } = this.state;
        const filteredCurrencies = updatedCurrencyList.filter((currency) =>
            currency.key.toLowerCase().includes(search.toLowerCase())
        );

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: 'Add Currencies',
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
                        value={this.state.search}
                        inputStyle={{
                            color: themeColor('text')
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
                        data={filteredCurrencies}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => {
                                    // Navigate back to the CurrencyConverter view with the selected currency
                                    navigation.navigate('CurrencyConverter', {
                                        selectedCurrency: item.value
                                    });
                                }}
                            >
                                <View>
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 16,
                                            margin: 16
                                        }}
                                    >
                                        {item.key}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item, index) => index.toString()}
                        ItemSeparatorComponent={this.renderSeparator}
                    />
                </View>
            </Screen>
        );
    }
}
