import * as React from 'react';
import {
    TouchableOpacity,
    View,
    StyleSheet,
    Animated,
    Easing,
    ScrollView,
    FlatListProps
} from 'react-native';

import { observer, inject } from 'mobx-react';
import Svg, { Text } from 'react-native-svg';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import { Icon } from 'react-native-elements';
import isEmpty from 'lodash/isEmpty';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import TextInput from '../../components/TextInput';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { numberWithCommas } from '../../utils/UnitsUtils';

import Storage from '../../storage';

import FiatStore from '../../stores/FiatStore';
import { CURRENCY_KEYS, CURRENCY_CODES_KEY } from '../../stores/SettingsStore';

import Add from '../../assets/images/SVG/Add.svg';
import Edit from '../../assets/images/SVG/Pen.svg';
import DragDots from '../../assets/images/SVG/DragDots.svg';
import BitcoinIcon from '../../assets/images/SVG/bitcoin-icon.svg';

interface Props<T> extends Omit<FlatListProps<T>, 'renderItem'> {
    data: T[];
    keyExtractor: (item: T, index: number) => string;
    renderItem: (info: DragListRenderItemInfo<T>) => React.ReactElement | null;
    onReordered?: (fromIndex: number, toIndex: number) => Promise<void> | void;
}

interface CurrencyConverterProps {
    navigation: StackNavigationProp<any, any>;
    FiatStore?: FiatStore;
    route: Route<'CurrencyConverter', { selectedCurrency: string }>;
}

interface CurrencyConverterState {
    inputValues: { [key: string]: string };
    selectedCurrency: string;
    editMode: boolean;
    fadeAnim: Animated.Value;
}

const EMOJI_REPLACEMENTS = {
    XAU: 'Au',
    XAG: 'Ag'
};

const TypedDragList = DragList as unknown as React.ComponentType<Props<string>>;

@inject('FiatStore')
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
                sats: ''
            },
            selectedCurrency: '',
            editMode: false,
            fadeAnim: new Animated.Value(0)
        };
    }

    componentDidMount() {
        this.retrieveInputValues();
        this.addDefaultCurrenciesToStorage();
        const selectedCurrency = this.props.route.params?.selectedCurrency;
        if (selectedCurrency) {
            this.handleCurrencySelect(selectedCurrency);
        }
    }

    componentDidUpdate(prevProps: CurrencyConverterProps) {
        const selectedCurrency = this.props.route.params?.selectedCurrency;
        const prevSelectedCurrency = prevProps.route.params?.selectedCurrency;

        // Check if the selected currency prop has changed
        if (selectedCurrency !== prevSelectedCurrency) {
            this.handleCurrencySelect(selectedCurrency);
        }
    }

    addDefaultCurrenciesToStorage = async () => {
        try {
            const { inputValues } = this.state;

            const inputValuesString = await Storage.getItem(CURRENCY_CODES_KEY);
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
            await Storage.setItem(CURRENCY_CODES_KEY, existingInputValues);

            // Update the state with the updated inputValues
            this.setState({ inputValues: existingInputValues });
        } catch (error) {
            console.error('Error adding default currencies:', error);
        }
    };

    saveInputValues = async () => {
        try {
            await Storage.setItem(CURRENCY_CODES_KEY, this.state.inputValues);
        } catch (error) {
            console.error('Error saving input values:', error);
        }
    };

    retrieveInputValues = async () => {
        try {
            const inputValuesString = await Storage.getItem(CURRENCY_CODES_KEY);
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
        const sanitizedValue = value.replace(/,/g, '').replace(/[^\d.]/g, '');

        const { inputValues } = this.state;
        const FiatStore = this.props.FiatStore!;
        const fiatRates = FiatStore?.fiatRates || [];

        const formatNumber = (value: string, currency: string) => {
            // Check if the currency is BTC
            if (currency === 'BTC') {
                // If BTC and the value is greater than 1, apply formatting with numberWithCommas
                if (parseFloat(value) > 1) {
                    return numberWithCommas(value);
                } else {
                    // Otherwise, return the value as it is
                    return value;
                }
            } else {
                // For other currencies, apply formatting with numberWithCommas
                return numberWithCommas(value);
            }
        };

        const convertedValues: { [key: string]: string } = { ...inputValues };

        // If the input is empty, clear the corresponding currency values
        if (sanitizedValue === '') {
            convertedValues[currency] = '';
            Object.keys(convertedValues).forEach((key) => {
                if (key !== currency) {
                    convertedValues[key] = ''; // Clear all other currencies
                }
            });

            this.setState({ inputValues: convertedValues });
            return;
        }

        // Apply formatting to the input value before conversion
        const formattedValue = formatNumber(sanitizedValue, currency);

        // Set the input value
        convertedValues[currency] = formattedValue;

        // Convert the value to other currencies and BTC
        Object.keys(convertedValues).forEach((key) => {
            if (key !== currency) {
                let convertedValue = '';
                // Conversion from sats to currency
                if (currency === 'sats') {
                    // Convert sats to BTC first
                    const btcValue = (
                        parseFloat(sanitizedValue) / 100000000
                    ).toFixed(8);

                    if (key === 'BTC') {
                        convertedValue = btcValue;
                    } else {
                        // Then convert BTC to the target currency
                        const btcConversionRate = fiatRates.find(
                            (rate) => rate.currencyPair === `BTC_${key}`
                        )?.rate;

                        if (btcConversionRate) {
                            convertedValue = (
                                parseFloat(btcValue) * btcConversionRate
                            ).toFixed(2);
                        }
                    }
                } else if (currency === 'BTC') {
                    // Conversion from BTC to currency
                    const directRate = fiatRates.find(
                        (rate) => rate.currencyPair === `${currency}_${key}`
                    );
                    if (key === 'sats') {
                        convertedValue = (
                            parseFloat(sanitizedValue) * 100000000
                        ).toFixed(0);
                    }
                    if (directRate) {
                        convertedValue = (
                            parseFloat(sanitizedValue) * directRate.rate
                        ).toFixed(2);
                    }
                } else {
                    // Conversion from currency to currency
                    const btcToRate = fiatRates.find(
                        (rate) => rate.currencyPair === `BTC_${key}`
                    )?.rate;
                    const btcFromRate: any = fiatRates.find(
                        (rate) => rate.currencyPair === `BTC_${currency}`
                    )?.rate;

                    if (btcFromRate) {
                        const btcValue = (
                            parseFloat(sanitizedValue) / btcFromRate
                        ).toFixed(8);
                        if (key === 'BTC') {
                            convertedValue =
                                sanitizedValue === '' ? '' : btcValue;
                        } else if (key === 'sats') {
                            convertedValue =
                                sanitizedValue === ''
                                    ? ''
                                    : (
                                          parseFloat(btcValue) * 100000000
                                      ).toFixed(0); // Convert BTC to sats if sats is present
                        }
                    }

                    if (btcToRate && btcFromRate) {
                        const btcValue =
                            parseFloat(sanitizedValue) / btcFromRate;
                        convertedValue = (btcValue * btcToRate).toFixed(2);
                    }
                }

                // Apply formatting on currencies
                convertedValues[key] = formatNumber(convertedValue, key);
            }
        });

        // Update the state with the converted values
        this.setState({ inputValues: convertedValues });
    };

    handleDeleteCurrency = async (currency: string) => {
        try {
            // Retrieve inputValues from storage
            const inputValuesString = await Storage.getItem(CURRENCY_CODES_KEY);
            const existingInputValues = inputValuesString
                ? JSON.parse(inputValuesString)
                : {};

            // Create a copy of the inputValues object
            const updatedInputValues = { ...existingInputValues };

            // Remove the currency code from the inputValues object
            delete updatedInputValues[currency];

            // Save updated inputValues to storage
            await Storage.setItem(CURRENCY_CODES_KEY, updatedInputValues);

            // Update the component state with the updated inputValues
            this.setState({ inputValues: updatedInputValues });
        } catch (error) {
            console.error('Error deleting currency:', error);
        }
    };

    onReordered = async (fromIndex: number, toIndex: number) => {
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
        try {
            await Storage.setItem(CURRENCY_CODES_KEY, reorderedValues);
        } catch (error) {
            console.error('Error saving input values:', error);
        }
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
        const { navigation, FiatStore } = this.props;
        const { inputValues, editMode, fadeAnim } = this.state;
        const { fiatRates, loading, getFiatRates } = FiatStore!;

        let ratesNotFetched;
        if (isEmpty(fiatRates)) ratesNotFetched = true;

        const AddButton = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('SelectCurrency', {
                        currencyConverter: true
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
                        marginLeft: 8,
                        marginTop: -4
                    }}
                />
            </TouchableOpacity>
        );

        const EditButton = () => (
            <TouchableOpacity onPress={this.toggleEditMode}>
                <Edit
                    fill={themeColor('text')}
                    style={{
                        alignSelf: 'center',
                        marginTop: -4,
                        marginRight: 4
                    }}
                />
            </TouchableOpacity>
        );

        const getFlagEmoji = (currencyValue: string) => {
            if (
                EMOJI_REPLACEMENTS[
                    currencyValue as keyof typeof EMOJI_REPLACEMENTS
                ]
            )
                return EMOJI_REPLACEMENTS[
                    currencyValue as keyof typeof EMOJI_REPLACEMENTS
                ];

            const currency = CURRENCY_KEYS.find(
                (currency) => currency.value === currencyValue
            );
            if (currency) {
                return currency.key.split(' ')[0];
            }
            return '';
        };

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
                            {Object.keys(inputValues).length > 2 && (
                                <EditButton />
                            )}
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
                <View style={{ flex: 1 }}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                    >
                        {loading && (
                            <View style={{ flex: 1, padding: 15 }}>
                                <LoadingIndicator />
                            </View>
                        )}
                        {ratesNotFetched && !loading && (
                            <TouchableOpacity
                                style={{ flex: 1, padding: 15 }}
                                onPress={() => {
                                    getFiatRates();
                                }}
                            >
                                <ErrorMessage
                                    message={localeString(
                                        'views.Settings.CurrencyConverter.error'
                                    )}
                                />
                            </TouchableOpacity>
                        )}
                        <View
                            style={{
                                marginHorizontal: 16,
                                paddingBottom: 10
                            }}
                        >
                            <TypedDragList
                                onReordered={this.onReordered}
                                data={Object.keys(inputValues)}
                                keyExtractor={(item) => String(item)}
                                scrollEnabled={false}
                                renderItem={({
                                    item,
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
                                                {editMode &&
                                                    item !== 'BTC' &&
                                                    item !== 'sats' && (
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
                                                                        transform:
                                                                            [
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
                                                        item !== 'BTC' &&
                                                        item !== 'sats'
                                                            ? {
                                                                  transform: [
                                                                      {
                                                                          scaleX: inputBoxWidth
                                                                      }
                                                                  ]
                                                              }
                                                            : null
                                                    ]}
                                                >
                                                    <View
                                                        style={{
                                                            position:
                                                                'absolute',
                                                            right: [
                                                                'BTC',
                                                                'sats'
                                                            ].includes(item)
                                                                ? 20
                                                                : 16,
                                                            zIndex: 1
                                                        }}
                                                    >
                                                        {[
                                                            'BTC',
                                                            'sats'
                                                        ].includes(item) ? (
                                                            <BitcoinIcon
                                                                height={20}
                                                                width={20}
                                                            />
                                                        ) : (
                                                            <Svg
                                                                height="24"
                                                                width="24"
                                                            >
                                                                <Text
                                                                    fontSize="16"
                                                                    x="0"
                                                                    y="18"
                                                                >
                                                                    {getFlagEmoji(
                                                                        item
                                                                    )}
                                                                </Text>
                                                            </Svg>
                                                        )}
                                                    </View>

                                                    <TextInput
                                                        keyboardType="numeric"
                                                        suffix={item}
                                                        style={{
                                                            flex: 1
                                                        }}
                                                        right={80}
                                                        placeholder={localeString(
                                                            'views.Settings.CurrencyConverter.enterAmount'
                                                        )}
                                                        value={
                                                            inputValues[item]
                                                        }
                                                        onChangeText={(
                                                            value: string
                                                        ) =>
                                                            this.handleInputChange(
                                                                value,
                                                                item
                                                            )
                                                        }
                                                        autoCapitalize="none"
                                                    />
                                                </Animated.View>

                                                {editMode &&
                                                    item !== 'BTC' &&
                                                    item !== 'sats' && (
                                                        <TouchableOpacity
                                                            onPressIn={
                                                                onDragStart
                                                            }
                                                            onPressOut={
                                                                onDragEnd
                                                            }
                                                            accessibilityLabel={
                                                                'Reorder'
                                                            }
                                                        >
                                                            <Animated.View
                                                                style={[
                                                                    styles.dragHandle,
                                                                    {
                                                                        transform:
                                                                            [
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
                    </ScrollView>
                </View>
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
        flex: 1,
        flexDirection: 'row-reverse',
        alignItems: 'center'
    },
    deleteIcon: {
        marginRight: 16,
        marginLeft: 0
    },
    draggableItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    dragHandle: {
        marginLeft: 16,
        marginRight: 0
    }
});
