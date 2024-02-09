import * as React from 'react';
import { observer, inject } from 'mobx-react';
import {
    TouchableOpacity,
    View,
    StyleSheet,
    Animated,
    Easing
} from 'react-native';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import { Icon } from 'react-native-elements';
import EncryptedStorage from 'react-native-encrypted-storage';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import TextInput from '../../components/TextInput';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import FiatStore from '../../stores/FiatStore';
import SettingsStore from '../../stores/SettingsStore';

import Add from '../../assets/images/SVG/Add.svg';
import Edit from '../../assets/images/SVG/Pen.svg';
import DragDots from '../../assets/images/SVG/DragDots.svg';

interface CurrencyConverterProps {
    navigation: any;
    FiatStore?: FiatStore;
    SettingsStore?: SettingsStore;
}

interface CurrencyConverterState {
    inputValues: { [key: string]: string };
    selectedCurrency: string;
    editMode: boolean;
    fadeAnim: Animated.Value;
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
            },
            selectedCurrency: '',
            editMode: false,
            fadeAnim: new Animated.Value(0)
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

    onReordered = (fromIndex: number, toIndex: number) => {
        const { inputValues } = this.state;
        const keys = Object.keys(inputValues);
        const copy: { [key: string]: string } = {};

        // Create a copy of inputValues object
        keys.forEach((key) => {
            copy[key] = inputValues[key];
        });

        // Reorder keys array
        keys.splice(toIndex, 0, keys.splice(fromIndex, 1)[0]);

        // Create a new object with reordered inputValues
        const reorderedValues: { [key: string]: string } = {};
        keys.forEach((key) => {
            reorderedValues[key] = copy[key];
        });

        // Update state with reordered inputValues
        this.setState({
            inputValues: reorderedValues
        });
    };

    toggleEditMode = () => {
        const { editMode, fadeAnim } = this.state;
        this.setState({ editMode: !editMode });

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: editMode ? 0 : 1,
                duration: 350,
                easing: Easing.ease,
                useNativeDriver: false
            })
        ]).start();
    };

    render() {
        const { navigation, FiatStore, SettingsStore } = this.props;
        const fiatRates = FiatStore?.fiatRates || [];
        const { inputValues, editMode, fadeAnim } = this.state;
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
                    style={{
                        alignSelf: 'center',
                        marginLeft: 10,
                        marginTop: -8
                    }}
                />
            </TouchableOpacity>
        );

        const EditButton = () => (
            <TouchableOpacity onPress={this.toggleEditMode}>
                <Edit
                    fill={themeColor('text')}
                    style={{ alignSelf: 'center', marginTop: -8 }}
                />
            </TouchableOpacity>
        );

        const inputBoxWidth = fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, editMode ? 1 : 0.8]
        });

        const slideInLeft = fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [editMode ? -50 : 0, 0]
        });

        const slideInRight = fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [editMode ? 50 : 0, 0]
        });

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    rightComponent={
                        <Row>
                            <EditButton />
                            <AddButton />
                        </Row>
                    }
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
                    <View style={{ marginHorizontal: 22 }}>
                        <DragList
                            onReordered={this.onReordered}
                            data={Object.keys(inputValues)}
                            keyExtractor={(item: any) => item}
                            renderItem={({
                                item,
                                index,
                                onDragStart,
                                onDragEnd
                            }: DragListRenderItemInfo<any>) => {
                                const { inputValues } = this.state;
                                return (
                                    <View style={styles.draggableItem}>
                                        <View
                                            style={styles.inputContainer}
                                            key={item}
                                        >
                                            {editMode && (
                                                <TouchableOpacity
                                                    onPress={() =>
                                                        this.handleDeleteCurrency(
                                                            item
                                                        )
                                                    }
                                                >
                                                    <Animated.View
                                                        style={[
                                                            styles.deleteIcon,
                                                            {
                                                                transform: [
                                                                    {
                                                                        translateX:
                                                                            slideInLeft
                                                                    }
                                                                ]
                                                            }
                                                        ]}
                                                    >
                                                        <Icon
                                                            name="delete"
                                                            size={28}
                                                            color={themeColor(
                                                                'delete'
                                                            )}
                                                        />
                                                    </Animated.View>
                                                </TouchableOpacity>
                                            )}

                                            <Animated.View
                                                style={[
                                                    styles.inputBox,
                                                    {
                                                        transform: [
                                                            {
                                                                scaleX: inputBoxWidth
                                                            }
                                                        ]
                                                    }
                                                ]}
                                            >
                                                <TextInput
                                                    suffix={item}
                                                    placeholder={`Enter amount in ${item}`}
                                                    value={inputValues[item]}
                                                    onChangeText={(value) =>
                                                        this.handleInputChange(
                                                            value,
                                                            item
                                                        )
                                                    }
                                                    autoCapitalize="none"
                                                />
                                            </Animated.View>

                                            {editMode && (
                                                <TouchableOpacity
                                                    onPressIn={onDragStart}
                                                    onPressOut={onDragEnd}
                                                    accessibilityLabel={
                                                        'Reorder'
                                                    }
                                                >
                                                    <Animated.View
                                                        style={[
                                                            styles.dragHandle,
                                                            {
                                                                transform: [
                                                                    {
                                                                        translateX:
                                                                            slideInRight
                                                                    }
                                                                ]
                                                            }
                                                        ]}
                                                    >
                                                        <DragDots
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="30"
                                                            height="30"
                                                        />
                                                    </Animated.View>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            }}
                        />
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    inputBox: {
        flex: 1
    },
    deleteIcon: {
        marginRight: 16,
        marginLeft: -6
    },
    draggableItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    dragHandle: {
        marginLeft: 16,
        marginRight: -6
    }
});
