import * as React from 'react';
import { View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Screen from '../../components/Screen';
import Header from '../../components/Header';

import SettingsStore, {
    CURRENCY_KEYS,
    DEFAULT_FIAT,
    DEFAULT_FIAT_RATES_SOURCE,
    FIAT_RATES_SOURCE_KEYS
} from '../../stores/SettingsStore';

import UnitsStore from '../../stores/UnitsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import DropdownSetting from '../../components/DropdownSetting';
import Switch from '../../components/Switch';

interface CurrencyProps {
    navigation: any;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
}

interface CurrencyState {
    fiatEnabled: boolean | undefined;
    selectedCurrency: string | undefined;
    fiatRatesSource: string;
}

@inject('SettingsStore', 'UnitsStore')
@observer
export default class Currency extends React.Component<
    CurrencyProps,
    CurrencyState
> {
    state = {
        fiatEnabled: false,
        selectedCurrency: '',
        fiatRatesSource: DEFAULT_FIAT_RATES_SOURCE
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            fiatEnabled: settings.fiatEnabled,
            selectedCurrency: settings.fiat,
            fiatRatesSource: settings.fiatRatesSource
        });
    }

    async componentDidUpdate(
        _prevProps: Readonly<CurrencyProps>,
        prevState: Readonly<CurrencyState>,
        _snapshot?: any
    ): Promise<void> {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();
        if (prevState.selectedCurrency !== settings.fiat) {
            this.setState({
                selectedCurrency: settings.fiat
            });
        }
    }

    navigateToSelectCurrency = () => {
        this.props.navigation.navigate('SelectCurrency');
    };

    render() {
        const { navigation, SettingsStore, UnitsStore } = this.props;
        const { fiatEnabled, selectedCurrency, fiatRatesSource } = this.state;
        const { updateSettings }: any = SettingsStore;

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
                    <ListItem
                        containerStyle={{
                            borderBottomWidth: 0,
                            backgroundColor: 'transparent'
                        }}
                        hasTVPreferredFocus={false}
                        tvParallaxProperties={{}}
                    >
                        <ListItem.Title
                            style={{
                                color: themeColor('secondaryText'),
                                fontFamily: 'Lato-Regular'
                            }}
                        >
                            {localeString('views.Settings.Currency.enabled')}
                        </ListItem.Title>
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                justifyContent: 'flex-end'
                            }}
                        >
                            <Switch
                                value={fiatEnabled}
                                onValueChange={async () => {
                                    const newFiatEnabled = !fiatEnabled;
                                    this.setState({
                                        fiatEnabled: newFiatEnabled
                                    });
                                    await updateSettings({
                                        fiatEnabled: newFiatEnabled
                                    });
                                    if (!newFiatEnabled) {
                                        if (UnitsStore.units === 'fiat') {
                                            UnitsStore.resetUnits();
                                        }
                                    }
                                }}
                            />
                        </View>
                    </ListItem>
                    <View style={{ marginHorizontal: 16 }}>
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
                                    !CURRENCY_KEYS.find(
                                        (c) => c.value === selectedCurrency
                                    )?.supportedSources.includes(value)
                                ) {
                                    newSettings.fiat = DEFAULT_FIAT;
                                    this.setState({
                                        selectedCurrency: DEFAULT_FIAT
                                    });
                                }
                                await updateSettings(newSettings);
                            }}
                            values={FIAT_RATES_SOURCE_KEYS}
                        />
                    </View>
                    <ListItem
                        containerStyle={{
                            backgroundColor: 'transparent'
                        }}
                        onPress={() => this.navigateToSelectCurrency()}
                        hasTVPreferredFocus={false}
                        tvParallaxProperties={{}}
                    >
                        <ListItem.Content>
                            <ListItem.Title
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'Lato-Regular'
                                }}
                            >
                                {localeString(
                                    'views.Settings.Currency.selectCurrency'
                                ) + ` (${selectedCurrency})`}
                            </ListItem.Title>
                        </ListItem.Content>
                        <Icon
                            name="keyboard-arrow-right"
                            color={themeColor('secondaryText')}
                            tvParallaxProperties={{}}
                        />
                    </ListItem>
                </View>
            </Screen>
        );
    }
}
