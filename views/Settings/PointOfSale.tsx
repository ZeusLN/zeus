import * as React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import CaretRight from '../../assets/images/SVG/Caret Right.svg';
import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import { Row } from '../../components/layout/Row';
import {
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

import SettingsStore, {
    DEFAULT_VIEW_KEYS_POS,
    POS_CONF_PREF_KEYS,
    POS_ENABLED_KEYS,
    PosEnabled
} from '../../stores/SettingsStore';

interface PointOfSaleProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

interface PointOfSaleState {
    posEnabled: PosEnabled;
    squareAccessToken: string;
    squareLocationId: string;
    merchantName: string;
    confirmationPreference: string;
    disableTips: boolean;
    squareDevMode: boolean;
    showKeypad: boolean;
    taxPercentage: string;
    enablePrinter: boolean;
    defaultView: string;
}

@inject('SettingsStore')
@observer
export default class PointOfSale extends React.Component<
    PointOfSaleProps,
    PointOfSaleState
> {
    state = {
        posEnabled: PosEnabled.Disabled,
        squareAccessToken: '',
        squareLocationId: '',
        merchantName: '',
        confirmationPreference: 'lnOnly',
        disableTips: false,
        squareDevMode: false,
        showKeypad: true,
        taxPercentage: '',
        enablePrinter: false,
        defaultView: 'Products'
    };

    async componentDidMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            posEnabled: settings?.pos?.posEnabled || PosEnabled.Disabled,
            squareAccessToken: settings?.pos?.squareAccessToken || '',
            squareLocationId: settings?.pos?.squareLocationId || '',
            merchantName: settings?.pos?.merchantName || '',
            confirmationPreference:
                settings?.pos?.confirmationPreference || 'lnOnly',
            disableTips: settings?.pos?.disableTips || false,
            squareDevMode: settings?.pos?.squareDevMode || false,
            showKeypad: settings?.pos?.showKeypad || false,
            taxPercentage: settings?.pos?.taxPercentage || '',
            enablePrinter: settings?.pos?.enablePrinter || false,
            defaultView:
                (settings?.pos && settings?.pos?.defaultView) || 'Products'
        });
    }

    componentWillUnmount() {
        // Persist a token, name or tax rate typed just before leaving
        this.props.SettingsStore.flushPendingSettings();
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
        const { navigation, SettingsStore } = this.props;
        const {
            posEnabled,
            squareAccessToken,
            squareLocationId,
            merchantName,
            confirmationPreference,
            disableTips,
            squareDevMode,
            showKeypad,
            taxPercentage,
            enablePrinter,
            defaultView
        } = this.state;
        const { settings, updateSettingsGroup, updateSettingsGroupDebounced } =
            SettingsStore;
        const { passphrase, pin, fiatEnabled } = settings;

        const LIST_ITEMS = [
            {
                label: localeString('views.Settings.POS.recon'),
                path: 'PointOfSaleRecon'
            }
        ];
        if (posEnabled === PosEnabled.Standalone) {
            LIST_ITEMS.push({
                label: localeString('views.Settings.POS.Categories'),
                path: 'Categories'
            });
            LIST_ITEMS.push({
                label: localeString('views.Settings.POS.Products'),
                path: 'Products'
            });
        }

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.pos'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={{ flex: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ padding: 15 }}>
                        {!fiatEnabled && posEnabled === 'square' && (
                            <ErrorMessage
                                message={localeString(
                                    'pos.views.Settings.PointOfSale.currencyMustBeEnabledError'
                                )}
                            />
                        )}
                        {!BackendUtils.isLNDBased() && (
                            <WarningMessage
                                message={localeString(
                                    'pos.views.Settings.PointOfSale.backendWarning'
                                )}
                            />
                        )}
                        {!pin && !passphrase && (
                            <WarningMessage
                                message={localeString(
                                    'pos.views.Settings.PointOfSale.authWarning'
                                )}
                            />
                        )}

                        <DropdownSetting
                            title={localeString('views.Settings.POS.enablePos')}
                            selectedValue={posEnabled}
                            onValueChange={async (value: PosEnabled) => {
                                const { SettingsStore } = this.props;
                                const { setPosStatus } = SettingsStore;

                                this.setState({
                                    posEnabled: value
                                });
                                if (value === PosEnabled.Disabled) {
                                    setPosStatus('unselected');
                                }
                                await updateSettingsGroup('pos', {
                                    posEnabled: value
                                });
                            }}
                            values={POS_ENABLED_KEYS}
                        />

                        {posEnabled === PosEnabled.Square && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.squareAccessToken'
                                    )}
                                </Text>
                                <TextInput
                                    value={squareAccessToken}
                                    onChangeText={(text: string) => {
                                        this.setState({
                                            squareAccessToken: text
                                        });

                                        updateSettingsGroupDebounced('pos', {
                                            squareAccessToken: text
                                        });
                                    }}
                                />

                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.squareLocationId'
                                    )}
                                </Text>
                                <TextInput
                                    value={squareLocationId}
                                    onChangeText={(text: string) => {
                                        this.setState({
                                            squareLocationId: text
                                        });

                                        updateSettingsGroupDebounced('pos', {
                                            squareLocationId: text
                                        });
                                    }}
                                />

                                <View style={styles.switchRow}>
                                    <Text
                                        style={{
                                            ...styles.settingLabel,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.POS.devMode'
                                        )}
                                    </Text>
                                    <Switch
                                        value={squareDevMode}
                                        onValueChange={async (
                                            value: boolean
                                        ) => {
                                            this.setState({
                                                squareDevMode: value
                                            });
                                            await updateSettingsGroup('pos', {
                                                squareDevMode: value
                                            });
                                        }}
                                    />
                                </View>
                            </>
                        )}

                        {posEnabled !== PosEnabled.Disabled && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.merchantName'
                                    )}
                                </Text>
                                <TextInput
                                    value={merchantName}
                                    onChangeText={(text: string) => {
                                        this.setState({
                                            merchantName: text
                                        });

                                        updateSettingsGroupDebounced('pos', {
                                            merchantName: text
                                        });
                                    }}
                                />
                                <DropdownSetting
                                    title={localeString(
                                        'views.Settings.POS.confPref'
                                    )}
                                    selectedValue={confirmationPreference}
                                    onValueChange={async (value: string) => {
                                        this.setState({
                                            confirmationPreference: value
                                        });
                                        await updateSettingsGroup('pos', {
                                            confirmationPreference: value
                                        });
                                    }}
                                    values={POS_CONF_PREF_KEYS}
                                />
                                {posEnabled === PosEnabled.Standalone && (
                                    <DropdownSetting
                                        title={localeString(
                                            'views.Settings.Display.defaultView'
                                        )}
                                        selectedValue={defaultView}
                                        onValueChange={async (
                                            value: string
                                        ) => {
                                            this.setState({
                                                defaultView: value
                                            });
                                            await updateSettingsGroup('pos', {
                                                defaultView: value
                                            });
                                        }}
                                        values={DEFAULT_VIEW_KEYS_POS}
                                    />
                                )}

                                <View style={styles.switchRow}>
                                    <Text
                                        style={{
                                            ...styles.settingLabel,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.POS.disableTips'
                                        )}
                                    </Text>
                                    <Switch
                                        value={disableTips}
                                        onValueChange={async (
                                            value: boolean
                                        ) => {
                                            this.setState({
                                                disableTips: value
                                            });
                                            await updateSettingsGroup('pos', {
                                                disableTips: value
                                            });
                                        }}
                                    />
                                </View>

                                {Platform.OS === 'android' && (
                                    <View style={styles.switchRow}>
                                        <Text
                                            style={{
                                                ...styles.settingLabel,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.POS.enablePrinter'
                                            )}
                                        </Text>
                                        <Switch
                                            value={enablePrinter}
                                            onValueChange={async (
                                                value: boolean
                                            ) => {
                                                this.setState({
                                                    enablePrinter: value
                                                });
                                                await updateSettingsGroup(
                                                    'pos',
                                                    {
                                                        enablePrinter: value
                                                    }
                                                );
                                            }}
                                        />
                                    </View>
                                )}
                            </>
                        )}

                        {posEnabled === PosEnabled.Standalone && (
                            <>
                                <View style={styles.switchRow}>
                                    <Text
                                        style={{
                                            ...styles.settingLabel,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.POS.showKeypad'
                                        )}
                                    </Text>
                                    <Switch
                                        value={showKeypad}
                                        onValueChange={async (
                                            value: boolean
                                        ) => {
                                            this.setState({
                                                showKeypad: value
                                            });
                                            await updateSettingsGroup('pos', {
                                                showKeypad: value
                                            });
                                        }}
                                    />
                                </View>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                    infoModalText={localeString(
                                        'views.Settings.POS.taxPercentage.global.info'
                                    )}
                                >
                                    {localeString(
                                        'views.Settings.POS.taxPercentage'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={'0'}
                                    value={taxPercentage}
                                    keyboardType="numeric"
                                    onChangeText={(text: string) => {
                                        this.setState({
                                            taxPercentage: text
                                        });

                                        updateSettingsGroupDebounced('pos', {
                                            taxPercentage: text
                                        });
                                    }}
                                    suffix="%"
                                />
                            </>
                        )}
                        {posEnabled !== PosEnabled.Disabled &&
                            LIST_ITEMS.map((item, index) => (
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate(item.path)
                                    }
                                    key={`${item.label}-${index}`}
                                >
                                    <View style={styles.tappableRow}>
                                        <Row justify="space-between">
                                            <Text style={styles.settingLabel}>
                                                {item.label}
                                            </Text>
                                            <CaretRight
                                                fill={themeColor(
                                                    'secondaryText'
                                                )}
                                                width="20"
                                                height="20"
                                            />
                                        </Row>
                                    </View>
                                </TouchableOpacity>
                            ))}
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16
    },
    tappableRow: {
        paddingVertical: 16
    },
    settingLabel: {
        fontSize: 17
    }
});
