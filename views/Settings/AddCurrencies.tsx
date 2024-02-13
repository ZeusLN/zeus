import * as React from 'react';
import { SearchBar } from 'react-native-elements';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { themeColor } from '../../utils/ThemeUtils';

import { FlatList, Text, TouchableOpacity, View } from 'react-native';

import { CURRENCY_KEYS } from '../../stores/SettingsStore';
import { localeString } from '../../utils/LocaleUtils';

import Bitcoin from '../../assets/images/SVG/bitcoin-icon.svg';

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
                key: 'Bitcoin (BTC)',
                value: 'BTC',
                svg: <Bitcoin width={20} height={20} />
            },
            {
                key: 'Satoshis (SAT)',
                value: 'SAT',
                svg: <Bitcoin width={20} height={20} />
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
                                    navigation.navigate('CurrencyConverter', {
                                        selectedCurrency: item.value
                                    });
                                }}
                            >
                                <View>
                                    <View
                                        style={{
                                            margin: 16,
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {['BTC', 'SAT'].includes(
                                            item.value
                                        ) && (
                                            <View
                                                style={{
                                                    marginRight: 6,
                                                    paddingLeft: 1
                                                }}
                                            >
                                                {item.svg}
                                            </View>
                                        )}
                                        <View>
                                            <Text
                                                style={{
                                                    color: themeColor('text'),
                                                    fontSize: 16,
                                                    fontFamily:
                                                        'PPNeueMontreal-Book'
                                                }}
                                            >
                                                {item.key}
                                            </Text>
                                        </View>
                                    </View>
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
