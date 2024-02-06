import * as React from 'react';
import Screen from '../../components/Screen';
import Header from '../../components/Header';
import TextInput from '../../components/TextInput';
import EncryptedStorage from 'react-native-encrypted-storage';
import { themeColor } from '../../utils/ThemeUtils';
import { ScrollView, TouchableOpacity, View, Text } from 'react-native';
import FiatStore from '../../stores/FiatStore';
import SettingsStore from '../../stores/SettingsStore';
import { observer, inject } from 'mobx-react';
import { StyleSheet } from 'react-native';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { localeString } from '../../utils/LocaleUtils';
import Add from '../../assets/images/SVG/Add.svg';
import { Icon } from 'react-native-elements';

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

    componentDidMount() {
        const { navigation } = this.props;
        this.retrieveInputValues();
        this.addDefaultCurrenciesToStorage();
        const selectedCurrency = navigation.getParam('selectedCurrency', '');
        if (selectedCurrency) {
            this.handleCurrencySelect(selectedCurrency);
        }
    }

    componentDidUpdate(prevProps) {
        const { navigation } = this.props;
        const selectedCurrency = navigation.getParam('selectedCurrency', '');
        const prevSelectedCurrency = prevProps.navigation.getParam(
            'selectedCurrency',
            ''
        );

        // Check if the selected currency prop has changed
        if (selectedCurrency !== prevSelectedCurrency) {
            this.handleCurrencySelect(selectedCurrency);
        }
    }

    addDefaultCurrenciesToStorage = async () => {
        try {
            const { inputValues } = this.state;

            const inputValuesString = await EncryptedStorage.getItem(
                'currency-codes'
            );
            const existingInputValues = inputValuesString
                ? JSON.parse(inputValuesString)
                : {};

            // Add default currencies from state to existing inputValues
            for (const currency of Object.keys(inputValues)) {
                if (!existingInputValues.hasOwnProperty(currency)) {
                    existingInputValues[currency] = '';
                }
            }

            // Save updated inputValues to storage
            await EncryptedStorage.setItem(
                'currency-codes',
                JSON.stringify(existingInputValues)
            );

            // Update the state with the updated inputValues
            this.setState({ inputValues: existingInputValues });
        } catch (error) {
            console.error('Error adding default currencies:', error);
        }
    };

    saveInputValues = async () => {
        try {
            await EncryptedStorage.setItem(
                'currency-codes',
                JSON.stringify(this.state.inputValues)
            );
        } catch (error) {
            console.error('Error saving input values:', error);
        }
    };

    retrieveInputValues = async () => {
        try {
            const inputValuesString = await EncryptedStorage.getItem(
                'currency-codes'
            );
            if (inputValuesString) {
                const inputValues = JSON.parse(inputValuesString);
                this.setState({ inputValues });
            }
        } catch (error) {
            console.error('Error retrieving input values:', error);
        }
    };

    handleCurrencySelect = (currency: string) => {
        const { inputValues } = this.state;

        if (!inputValues.hasOwnProperty(currency)) {
            const updatedInputValues = { ...inputValues, [currency]: '' };
            this.setState(
                {
                    inputValues: updatedInputValues,
                    selectedCurrency: currency
                },
                () => {
                    this.saveInputValues();
                }
            );
        } else {
            this.setState({ selectedCurrency: currency });
        }
    };

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
                        // Conversion from currency to currency
                        const btcToRate = fiatRates.find(
                            (rate) => rate.currencyPair === `BTC_${key}`
                        )?.rate;
                        const btcFromRate = fiatRates.find(
                            (rate) => rate.currencyPair === `BTC_${currency}`
                        )?.rate;

                        if (btcToRate && btcFromRate) {
                            conversionRate = btcToRate / btcFromRate;
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

    renderInputFields = () => {
        const { inputValues } = this.state;

        return Object.keys(inputValues).map((currency) => (
            <View style={styles.inputContainer} key={currency}>
                <TextInput
                    style={styles.inputBox}
                    suffix={currency}
                    placeholder={`Enter amount in ${currency}`}
                    value={inputValues[currency]}
                    onChangeText={(value) =>
                        this.handleInputChange(value, currency)
                    }
                    autoCapitalize="none"
                />

                <TouchableOpacity
                    onPress={() => this.handleDeleteCurrency(currency)}
                >
                    <Icon
                        name="delete"
                        size={24}
                        color="red"
                        style={styles.deleteIcon}
                    />
                </TouchableOpacity>
            </View>
        ));
    };

    handleDeleteCurrency = async (currency: string) => {
        try {
            // Retrieve inputValues from storage
            const inputValuesString = await EncryptedStorage.getItem(
                'currency-codes'
            );
            const existingInputValues = inputValuesString
                ? JSON.parse(inputValuesString)
                : {};

            // Create a copy of the inputValues object
            const updatedInputValues = { ...existingInputValues };

            // Remove the currency code from the inputValues object
            delete updatedInputValues[currency];

            // Save updated inputValues to storage
            await EncryptedStorage.setItem(
                'currency-codes',
                JSON.stringify(updatedInputValues)
            );

            // Update the component state with the updated inputValues
            this.setState({ inputValues: updatedInputValues });
        } catch (error) {
            console.error('Error deleting currency:', error);
        }
    };

    render() {
        const { navigation, FiatStore, SettingsStore } = this.props;
        const fiatRates = FiatStore?.fiatRates || [];
        const { inputValues } = this.state;
        const { settings }: any = SettingsStore;
        const { fiatEnabled } = settings;

        const AddButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('AddCurrencies', {
                        fiatRates: fiatRates
                    })
                }
                accessibilityLabel={localeString('general.add')}
            >
                <Add
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    rightComponent={<AddButton />}
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
                            {this.renderInputFields()}
                        </View>
                    </ScrollView>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    inputBox: {
        flex: 1
    },
    deleteIcon: {
        marginLeft: 10
    }
});
