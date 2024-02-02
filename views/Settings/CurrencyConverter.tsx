import * as React from 'react';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import TextInput from '../../components/TextInput';
import DropdownSetting from '../../components/DropdownSetting';
import { themeColor } from '../../utils/ThemeUtils';
import { ScrollView, View } from 'react-native';
import FiatStore from '../../stores/FiatStore';
import SettingsStore from '../../stores/SettingsStore';
import { observer, inject } from 'mobx-react';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { localeString } from '../../utils/LocaleUtils';

interface CurrencyConverterProps {
    navigation: any;
    FiatStore?: FiatStore;
    SettingsStore?: SettingsStore;
}

interface CurrencyConverterState {
    inputValues: { [key: string]: string };
    selectedCurrency: string;
}

@inject('FiatStore', 'SettingsStore')
@observer
export default class CurrencyConverter extends React.Component<
    CurrencyConverterProps,
    CurrencyConverterState
> {
    constructor(props: CurrencyConverterProps) {
        super(props);
        this.state = {
            inputValues: {
                BTC: '',
                USD: ''
                // Here we can add other default currencies as well
            },
            selectedCurrency: ''
        };
    }

    handleInputChange = (value: string, currency: string) => {
        const { inputValues } = this.state;
        const { FiatStore } = this.props;
        const fiatRates = FiatStore?.fiatRates || [];

        const convertedValues: { [key: string]: string } = { ...inputValues };

        // Set the input value
        convertedValues[currency] = value;

        // Convert the value to other currencies and BTC
        Object.keys(convertedValues).forEach((key) => {
            if (key !== currency) {
                let conversionRate: number | null = null;

                // Check if the value is empty
                if (value === '') {
                    convertedValues[key] = ''; // Set the converted value to empty string
                } else {
                    // Check if there's a direct conversion rate
                    const directRate = fiatRates.find(
                        (rate) => rate.currencyPair === `${currency}_${key}`
                    );
                    if (directRate) {
                        conversionRate = directRate.rate;
                    } else {
                        // Check if there's a conversion rate from BTC
                        const btcToRate = fiatRates.find(
                            (rate) => rate.currencyPair === `BTC_${key}`
                        )?.rate;
                        const btcFromRate = fiatRates.find(
                            (rate) => rate.currencyPair === `BTC_${currency}`
                        )?.rate;

                        if (btcToRate && btcFromRate) {
                            conversionRate = btcToRate / btcFromRate;
                        } else {
                            // Check if there's a conversion rate from the entered currency to BTC
                            const btcRateFrom = fiatRates.find(
                                (rate) =>
                                    rate.currencyPair === `${currency}_BTC`
                            )?.rate;
                            const btcRateTo = fiatRates.find(
                                (rate) =>
                                    rate.currencyPair === `BTC_${currency}`
                            )?.rate;

                            if (btcRateFrom && btcRateTo) {
                                conversionRate = 1 / btcRateFrom; // Invert the rate
                            }
                        }
                    }

                    if (conversionRate !== null) {
                        const convertedValue =
                            parseFloat(convertedValues[currency]) *
                            conversionRate;
                        convertedValues[key] = convertedValue.toFixed(2);
                    }
                }
            }
        });

        // Update the BTC value based on the entered currency
        if (currency !== 'BTC') {
            const btcConversionRate = fiatRates.find(
                (rate) => rate.currencyPair === `BTC_${currency}`
            )?.rate;
            if (btcConversionRate) {
                const btcValue = (
                    parseFloat(value) / btcConversionRate
                ).toFixed(8);
                convertedValues['BTC'] = value === '' ? '' : btcValue; // Set to empty string if value is empty
            }
        } else {
            // Check if the value is empty
            convertedValues['BTC'] = value === '' ? '' : convertedValues['BTC']; // Preserve current BTC value if value is empty
        }

        // Update the state with the converted values
        this.setState({ inputValues: convertedValues });
    };

    handleCurrencySelect = (currency: string) => {
        const { inputValues } = this.state;

        if (!inputValues.hasOwnProperty(currency)) {
            const updatedInputValues = { ...inputValues, [currency]: '' };
            this.setState({
                inputValues: updatedInputValues,
                selectedCurrency: currency
            });
        } else {
            this.setState({ selectedCurrency: currency });
        }
    };

    getConversionRate = (
        fromCurrency: string,
        toCurrency: string,
        fiatRates: any[]
    ) => {
        if (fromCurrency === toCurrency) return 1;

        // Look for direct conversion rate
        const directConversionRate = fiatRates.find(
            (rate) => rate.currencyPair === `${fromCurrency}_${toCurrency}`
        );

        if (directConversionRate) return directConversionRate.rate;

        // Look for BTC intermediary conversion
        const btcRateFrom = fiatRates.find(
            (rate) => rate.code === `BTC_${fromCurrency}`
        )?.rate;
        const btcRateTo = fiatRates.find(
            (rate) => rate.code === `BTC_${toCurrency}`
        )?.rate;

        if (btcRateFrom && btcRateTo) {
            return btcRateTo / btcRateFrom;
        }

        return null;
    };

    render() {
        const { navigation, FiatStore, SettingsStore } = this.props;
        const fiatRates = FiatStore?.fiatRates || [];
        const { inputValues, selectedCurrency } = this.state;
        const { settings }: any = SettingsStore;
        const { fiatEnabled } = settings;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'views.Settings.CurrencyConverter.title'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                {!fiatEnabled ? (
                    <View style={{ flex: 1, padding: 15 }}>
                        <ErrorMessage
                            message={localeString(
                                'pos.views.Settings.PointOfSale.currencyError'
                            )}
                        />
                    </View>
                ) : (
                    <ScrollView>
                        <View style={{ marginHorizontal: 22 }}>
                            {Object.keys(inputValues).map((currency) => (
                                <TextInput
                                    suffix={currency}
                                    key={currency}
                                    placeholder={`Enter amount in ${currency}`}
                                    value={inputValues[currency]}
                                    onChangeText={(value) =>
                                        this.handleInputChange(value, currency)
                                    }
                                    autoCapitalize="none"
                                />
                            ))}
                            <DropdownSetting
                                title="Select Currency"
                                selectedValue={selectedCurrency}
                                onValueChange={this.handleCurrencySelect}
                                values={fiatRates.map((rate) => ({
                                    key: rate.code,
                                    translateKey: rate.name,
                                    value: rate.code
                                }))}
                            />
                        </View>
                    </ScrollView>
                )}
            </Screen>
        );
    }
}
