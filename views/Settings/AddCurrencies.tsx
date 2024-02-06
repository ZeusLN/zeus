import * as React from 'react';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { themeColor } from '../../utils/ThemeUtils';
import {
    FlatList,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { CURRENCY_KEYS } from '../../stores/SettingsStore';

interface AddCurrenciesProps {
    navigation: any;
}

interface AddCurrenciesState {
    fiatRates: any[];
}

export default class AddCurrencies extends React.Component<
    AddCurrenciesProps,
    AddCurrenciesState
> {
    constructor(props: AddCurrenciesProps) {
        super(props);
        const fiatRates: any = this.props.navigation.getParam(
            'fiatRates',
            null
        );
        this.state = {
            fiatRates
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

    render() {
        const { navigation } = this.props;
        const { fiatRates } = this.state;

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
                    <FlatList
                        data={CURRENCY_KEYS}
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
