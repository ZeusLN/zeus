import * as React from 'react';
import {
    TouchableOpacity,
    View,
    StyleSheet,
    Animated,
    Easing,
    ScrollView,
    FlatListProps,
    Text
} from 'react-native';

import { observer, inject } from 'mobx-react';
import Svg, { Text as SvgText } from 'react-native-svg';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import { Icon } from '@rneui/themed';
import isEmpty from 'lodash/isEmpty';

import LoadingIndicator from './LoadingIndicator';
import TextInput from './TextInput';
import { ErrorMessage } from './SuccessErrorMessage';
import { Row } from './layout/Row';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import { numberWithCommas } from '../utils/UnitsUtils';

import Storage from '../storage';

import FiatStore from '../stores/FiatStore';
import { CURRENCY_KEYS, CURRENCY_CODES_KEY } from '../stores/SettingsStore';

import Add from '../assets/images/SVG/Add.svg';
import Checkmark from '../assets/images/SVG/Checkmark.svg';
import EditIcon from '../assets/images/SVG/Pen.svg';
import DragDots from '../assets/images/SVG/DragDots.svg';
import BitcoinIcon from '../assets/images/SVG/bitcoin-icon.svg';

interface Props<T> extends Omit<FlatListProps<T>, 'renderItem'> {
    data: T[];
    keyExtractor: (item: T, index: number) => string;
    renderItem: (info: DragListRenderItemInfo<T>) => React.ReactElement | null;
    onReordered?: (fromIndex: number, toIndex: number) => Promise<void> | void;
}

interface CurrencyConverterContentProps {
    navigation: NativeStackNavigationProp<any, any>;
    FiatStore?: FiatStore;
    showToolbar?: boolean;
    fromModal?: boolean;
    onInputValuesChanged?: (count: number) => void;
    onNavigateAway?: (navigate: () => void) => void;
}

interface CurrencyConverterContentState {
    inputValues: { [key: string]: string };
    editMode: boolean;
    fadeAnim: Animated.Value;
    isDragging: boolean;
}

const EMOJI_REPLACEMENTS = {
    XAU: 'Au',
    XAG: 'Ag'
};

const TypedDragList = DragList as unknown as React.ComponentType<Props<string>>;

@inject('FiatStore')
@observer
export default class CurrencyConverterContent extends React.Component<
    CurrencyConverterContentProps,
    CurrencyConverterContentState
> {
    private blurListener: (() => void) | undefined;
    // react-native-draglist suffixes every row key with a generation counter
    // that increments whenever `data` changes identity, remounting all rows
    // and dismissing the keyboard mid-typing. Reuse the same array while the
    // currency set is unchanged so value edits never remount the inputs.
    private currencyKeys: string[] = [];
    // Whether rates were loaded at the last render. FiatStore is a single
    // MobX instance, so prevProps.FiatStore holds the current rates too and
    // cannot show when they arrived.
    private hadRates: boolean;
    constructor(props: CurrencyConverterContentProps) {
        super(props);
        this.hadRates = !isEmpty(props.FiatStore?.fiatRates);
        this.state = {
            inputValues: {
                BTC: '',
                sats: ''
            },
            editMode: false,
            fadeAnim: new Animated.Value(0),
            isDragging: false
        };
    }

    componentDidMount() {
        // Fetch rates on entry only if we don't already have them.
        if (isEmpty(this.props.FiatStore?.fiatRates)) {
            this.props.FiatStore?.getFiatRates?.();
        }
        this.addDefaultCurrenciesToStorage();

        this.blurListener = this.props.navigation?.addListener?.(
            'blur',
            this.saveInputValues
        );
    }

    componentWillUnmount() {
        this.blurListener?.();
        this.saveInputValues();
    }

    componentDidUpdate(
        _prevProps: CurrencyConverterContentProps,
        prevState: CurrencyConverterContentState
    ) {
        const { onInputValuesChanged } = this.props;
        if (
            onInputValuesChanged &&
            prevState.inputValues !== this.state.inputValues
        ) {
            onInputValuesChanged(Object.keys(this.state.inputValues).length);
        }
        // Backfill fields once rates arrive (e.g. user typed BTC before rates loaded).
        const hasRates = !isEmpty(this.props.FiatStore?.fiatRates);
        if (hasRates && !this.hadRates) {
            this.syncConversions();
        }
        this.hadRates = hasRates;
    }

    syncConversions = () => {
        if (isEmpty(this.props.FiatStore?.fiatRates)) return;

        // Zeros are skipped: older versions saved 0 for a currency without a
        // rate, and taking that as the source would wipe a typed amount.
        const { inputValues } = this.state;
        const source = Object.keys(inputValues).find((key) => {
            const val = inputValues[key];
            return (
                typeof val === 'string' && parseFloat(val.replace(/,/g, '')) > 0
            );
        });
        if (!source) return;

        this.handleInputChange(inputValues[source], source);
    };

    public addCurrency = (currency: string) => {
        this.handleCurrencySelect(currency);
    };

    public refresh = () => {
        this.retrieveInputValues();
    };

    public get editMode() {
        return this.state.editMode;
    }

    public get inputValuesCount() {
        return Object.keys(this.state.inputValues).length;
    }

    addDefaultCurrenciesToStorage = async () => {
        try {
            const { inputValues } = this.state;

            const inputValuesString = await Storage.getItem(CURRENCY_CODES_KEY);
            const existingInputValues = inputValuesString
                ? JSON.parse(inputValuesString)
                : {};

            for (const currency of Object.keys(inputValues)) {
                if (!existingInputValues.hasOwnProperty(currency)) {
                    existingInputValues[currency] = '';
                }
            }

            await Storage.setItem(CURRENCY_CODES_KEY, existingInputValues);
            this.setState({ inputValues: existingInputValues }, () => {
                this.syncConversions();
            });
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
                this.setState({ inputValues }, () => {
                    this.syncConversions();
                });
            }
        } catch (error) {
            console.error('Error retrieving input values:', error);
        }
    };

    handleCurrencySelect = (currency: string) => {
        const { inputValues } = this.state;

        if (!inputValues.hasOwnProperty(currency)) {
            const updatedInputValues = { ...inputValues, [currency]: '' };
            this.setState({ inputValues: updatedInputValues }, () => {
                this.saveInputValues();
                this.syncConversions();
            });
        }
    };

    handleInputChange = (value: string, currency: string) => {
        const sanitizedValue = value.replace(/,/g, '').replace(/[^\d.]/g, '');

        const { inputValues } = this.state;
        const FiatStore = this.props.FiatStore!;
        const fiatRates = FiatStore?.fiatRates || [];

        // Groups the whole part only; numberWithCommas would also group the
        // decimals (2.00000000 -> 2.00,000,000). An empty value stays empty
        // rather than becoming 0, so a currency without a rate shows nothing.
        const formatNumber = (value: string) => {
            if (value === '') return '';
            const [whole, ...decimals] = value.split('.');
            const groupedWhole = whole === '' ? '' : numberWithCommas(whole);
            return decimals.length > 0
                ? `${groupedWhole}.${decimals.join('.')}`
                : groupedWhole;
        };

        // toFixed, or empty when the result would not be plain digits: a lone
        // point parses as NaN, very long input as Infinity, and toFixed
        // switches to exponent notation (1e+21) from 1e21.
        const toFixed = (value: number, digits: number) =>
            Number.isFinite(value) && Math.abs(value) < 1e21
                ? value.toFixed(digits)
                : '';

        const convertedValues: { [key: string]: string } = { ...inputValues };

        if (sanitizedValue === '') {
            convertedValues[currency] = '';
            Object.keys(convertedValues).forEach((key) => {
                if (key !== currency) {
                    convertedValues[key] = '';
                }
            });

            this.setState(
                { inputValues: convertedValues },
                this.saveInputValues
            );
            return;
        }

        const formattedValue = formatNumber(sanitizedValue);
        convertedValues[currency] = formattedValue;

        Object.keys(convertedValues).forEach((key) => {
            if (key !== currency) {
                let convertedValue = '';
                if (currency === 'sats') {
                    const btcValue = toFixed(
                        parseFloat(sanitizedValue) / 100000000,
                        8
                    );

                    if (key === 'BTC') {
                        convertedValue = btcValue;
                    } else {
                        const btcConversionRate = fiatRates.find(
                            (rate) => rate.currencyPair === `BTC_${key}`
                        )?.rate;

                        if (btcConversionRate) {
                            convertedValue = toFixed(
                                parseFloat(btcValue) * btcConversionRate,
                                2
                            );
                        }
                    }
                } else if (currency === 'BTC') {
                    const directRate = fiatRates.find(
                        (rate) => rate.currencyPair === `${currency}_${key}`
                    );
                    if (key === 'sats') {
                        convertedValue = toFixed(
                            parseFloat(sanitizedValue) * 100000000,
                            0
                        );
                    }
                    if (directRate) {
                        convertedValue = toFixed(
                            parseFloat(sanitizedValue) * directRate.rate,
                            2
                        );
                    }
                } else {
                    const btcToRate = fiatRates.find(
                        (rate) => rate.currencyPair === `BTC_${key}`
                    )?.rate;
                    const btcFromRate: number | undefined = fiatRates.find(
                        (rate) => rate.currencyPair === `BTC_${currency}`
                    )?.rate;

                    if (btcFromRate) {
                        const btcValue = toFixed(
                            parseFloat(sanitizedValue) / btcFromRate,
                            8
                        );
                        if (key === 'BTC') {
                            convertedValue =
                                sanitizedValue === '' ? '' : btcValue;
                        } else if (key === 'sats') {
                            convertedValue =
                                sanitizedValue === ''
                                    ? ''
                                    : toFixed(
                                          parseFloat(btcValue) * 100000000,
                                          0
                                      );
                        }
                    }

                    if (btcToRate && btcFromRate) {
                        const btcValue =
                            parseFloat(sanitizedValue) / btcFromRate;
                        convertedValue = toFixed(btcValue * btcToRate, 2);
                    }
                }

                convertedValues[key] = formatNumber(convertedValue);
            }
        });

        this.setState({ inputValues: convertedValues }, this.saveInputValues);
    };

    handleDeleteCurrency = async (currency: string) => {
        try {
            const inputValuesString = await Storage.getItem(CURRENCY_CODES_KEY);
            const existingInputValues = inputValuesString
                ? JSON.parse(inputValuesString)
                : {};

            const updatedInputValues = { ...existingInputValues };
            delete updatedInputValues[currency];

            await Storage.setItem(CURRENCY_CODES_KEY, updatedInputValues);
            this.setState({ inputValues: updatedInputValues });
        } catch (error) {
            console.error('Error deleting currency:', error);
        }
    };

    onReordered = async (fromIndex: number, toIndex: number) => {
        const { inputValues } = this.state;
        const keys = Object.keys(inputValues);
        const copy: { [key: string]: string } = {};

        keys.forEach((key) => {
            copy[key] = inputValues[key];
        });

        keys.splice(toIndex, 0, keys.splice(fromIndex, 1)[0]);

        const reorderedValues: { [key: string]: string } = {};
        keys.forEach((key) => {
            reorderedValues[key] = copy[key];
        });

        try {
            await Storage.setItem(CURRENCY_CODES_KEY, reorderedValues);
        } catch (error) {
            console.error('Error saving input values:', error);
        }
        this.setState({
            inputValues: reorderedValues
        });
    };

    public toggleEditMode = () => {
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

    getStableCurrencyKeys = (): string[] => {
        const keys = Object.keys(this.state.inputValues);
        if (
            keys.length !== this.currencyKeys.length ||
            keys.some((key, index) => key !== this.currencyKeys[index])
        ) {
            this.currencyKeys = keys;
        }
        return this.currencyKeys;
    };

    handleAddPress = () => {
        const { navigation, fromModal, onNavigateAway } = this.props;
        const navigate = () =>
            navigation.navigate('SelectCurrency', {
                currencyConverter: true,
                fromModal: fromModal || false
            });
        // In the modal, let the host dismiss its window first and navigate
        // from its callback; navigating while the window is still up strands
        // an invisible dialog over the pushed screen on Android (#4451).
        if (onNavigateAway) {
            onNavigateAway(navigate);
        } else {
            navigate();
        }
    };

    render() {
        const { FiatStore, showToolbar = true } = this.props;
        const { inputValues, editMode, fadeAnim } = this.state;
        const { fiatRates, loading, getFiatRates } = FiatStore!;

        let ratesNotFetched;
        if (isEmpty(fiatRates)) ratesNotFetched = true;

        const AddButton = () => (
            <TouchableOpacity
                onPress={this.handleAddPress}
                accessibilityLabel={localeString('general.add')}
            >
                <Add
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{
                        alignSelf: 'center',
                        marginLeft: 8,
                        // eslint-disable-next-line zeus/no-negative-layout-offset -- TODO #2794
                        marginTop: -4
                    }}
                />
            </TouchableOpacity>
        );

        const EditButton = () => (
            <TouchableOpacity onPress={this.toggleEditMode}>
                {editMode ? (
                    <Checkmark
                        width={30}
                        height={30}
                        style={{
                            alignSelf: 'center',
                            // eslint-disable-next-line zeus/no-negative-layout-offset -- TODO #2794
                            marginTop: -4,
                            marginRight: 4
                        }}
                    />
                ) : (
                    <EditIcon
                        fill={themeColor('text')}
                        style={{
                            alignSelf: 'center',
                            // eslint-disable-next-line zeus/no-negative-layout-offset -- TODO #2794
                            marginTop: -4,
                            marginRight: 4
                        }}
                    />
                )}
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
            if (currency?.flag) {
                return currency.flag;
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
            <View style={{ flex: 1 }}>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    scrollEnabled={!this.state.isDragging}
                >
                    {showToolbar && (
                        <Row
                            style={{
                                justifyContent: 'flex-end',
                                paddingHorizontal: 16,
                                paddingVertical: 8
                            }}
                        >
                            {Object.keys(inputValues).length > 2 && (
                                <EditButton />
                            )}
                            <AddButton />
                        </Row>
                    )}
                    {loading && ratesNotFetched && (
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
                            data={this.getStableCurrencyKeys()}
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
                                                <TextInput
                                                    keyboardType="numeric"
                                                    style={{
                                                        flex: 1
                                                    }}
                                                    placeholder={localeString(
                                                        'views.Settings.CurrencyConverter.enterAmount'
                                                    )}
                                                    value={inputValues[item]}
                                                    onChangeText={(
                                                        value: string
                                                    ) =>
                                                        this.handleInputChange(
                                                            value,
                                                            item
                                                        )
                                                    }
                                                    autoCapitalize="none"
                                                    trailing={
                                                        <View
                                                            style={
                                                                styles.currencyTrailing
                                                            }
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.currencyLabel,
                                                                    {
                                                                        color: themeColor(
                                                                            'text'
                                                                        )
                                                                    }
                                                                ]}
                                                            >
                                                                {item}
                                                            </Text>
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
                                                                    <SvgText
                                                                        fontSize="16"
                                                                        x="0"
                                                                        y="18"
                                                                    >
                                                                        {getFlagEmoji(
                                                                            item
                                                                        )}
                                                                    </SvgText>
                                                                </Svg>
                                                            )}
                                                        </View>
                                                    }
                                                />
                                            </Animated.View>

                                            {editMode &&
                                                item !== 'BTC' &&
                                                item !== 'sats' && (
                                                    <TouchableOpacity
                                                        onPressIn={() => {
                                                            this.setState({
                                                                isDragging: true
                                                            });
                                                            onDragStart();
                                                        }}
                                                        onPressOut={() => {
                                                            this.setState({
                                                                isDragging:
                                                                    false
                                                            });
                                                            onDragEnd();
                                                        }}
                                                        accessibilityLabel={localeString(
                                                            'general.reorder'
                                                        )}
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
                </ScrollView>
            </View>
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
    },
    currencyTrailing: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    currencyLabel: {
        fontSize: 20,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
