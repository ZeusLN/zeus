import * as React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import {
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';

import SettingsStore, {
    DEFAULT_VIEW_KEYS_POS,
    POS_CONF_PREF_KEYS,
    POS_ENABLED_KEYS,
    PosEnabled
} from '../../stores/SettingsStore';

interface PointOfSaleProps {
    navigation: StackNavigationProp<any, any>;
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

    async UNSAFE_componentWillMount() {
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
        const { updateSettings, settings }: any = SettingsStore;
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
                                await updateSettings({
                                    pos: {
                                        ...settings.pos,
                                        posEnabled: value
                                    }
                                });
                            }}
                            values={POS_ENABLED_KEYS}
                            disabled={SettingsStore.settingsUpdateInProgress}
                        />

                        {posEnabled === PosEnabled.Square && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.squareAccessToken'
                                    )}
                                </Text>
                                <TextInput
                                    value={squareAccessToken}
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            squareAccessToken: text
                                        });

                                        await updateSettings({
                                            pos: {
                                                ...settings.pos,
                                                squareAccessToken: text
                                            }
                                        });
                                    }}
                                />

                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.squareLocationId'
                                    )}
                                </Text>
                                <TextInput
                                    value={squareLocationId}
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            squareLocationId: text
                                        });

                                        await updateSettings({
                                            pos: {
                                                ...settings.pos,
                                                squareLocationId: text
                                            }
                                        });
                                    }}
                                />

                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            left: -10
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.POS.devMode'
                                        )}
                                    </ListItem.Title>
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <Switch
                                            value={squareDevMode}
                                            disabled={
                                                SettingsStore.settingsUpdateInProgress
                                            }
                                            onValueChange={async () => {
                                                this.setState({
                                                    squareDevMode:
                                                        !squareDevMode
                                                });
                                                await updateSettings({
                                                    pos: {
                                                        ...settings.pos,
                                                        squareDevMode:
                                                            !squareDevMode
                                                    }
                                                });
                                            }}
                                        />
                                    </View>
                                </ListItem>
                            </>
                        )}

                        {posEnabled !== PosEnabled.Disabled && (
                            <>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.merchantName'
                                    )}
                                </Text>
                                <TextInput
                                    value={merchantName}
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            merchantName: text
                                        });

                                        await updateSettings({
                                            pos: {
                                                ...settings.pos,
                                                merchantName: text
                                            }
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
                                        await updateSettings({
                                            pos: {
                                                ...settings.pos,
                                                confirmationPreference: value
                                            }
                                        });
                                    }}
                                    values={POS_CONF_PREF_KEYS}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
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
                                            await updateSettings({
                                                pos: {
                                                    ...settings.pos,
                                                    defaultView: value
                                                }
                                            });
                                        }}
                                        values={DEFAULT_VIEW_KEYS_POS}
                                        disabled={
                                            SettingsStore.settingsUpdateInProgress
                                        }
                                    />
                                )}

                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            left: -10
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.POS.disableTips'
                                        )}
                                    </ListItem.Title>
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <Switch
                                            value={disableTips}
                                            disabled={
                                                SettingsStore.settingsUpdateInProgress
                                            }
                                            onValueChange={async () => {
                                                this.setState({
                                                    disableTips: !disableTips
                                                });
                                                await updateSettings({
                                                    pos: {
                                                        ...settings.pos,
                                                        disableTips:
                                                            !disableTips
                                                    }
                                                });
                                            }}
                                        />
                                    </View>
                                </ListItem>

                                {Platform.OS === 'android' && (
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor: 'transparent'
                                        }}
                                    >
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                left: -10
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.POS.enablePrinter'
                                            )}
                                        </ListItem.Title>
                                        <View
                                            style={{
                                                flex: 1,
                                                flexDirection: 'row',
                                                justifyContent: 'flex-end'
                                            }}
                                        >
                                            <Switch
                                                value={enablePrinter}
                                                disabled={
                                                    SettingsStore.settingsUpdateInProgress
                                                }
                                                onValueChange={async () => {
                                                    this.setState({
                                                        enablePrinter:
                                                            !enablePrinter
                                                    });
                                                    await updateSettings({
                                                        pos: {
                                                            ...settings.pos,
                                                            enablePrinter:
                                                                !enablePrinter
                                                        }
                                                    });
                                                }}
                                            />
                                        </View>
                                    </ListItem>
                                )}
                            </>
                        )}

                        {posEnabled === PosEnabled.Standalone && (
                            <>
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
                                >
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            left: -10
                                        }}
                                    >
                                        {localeString(
                                            'views.Settings.POS.showKeypad'
                                        )}
                                    </ListItem.Title>
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <Switch
                                            value={showKeypad}
                                            disabled={
                                                SettingsStore.settingsUpdateInProgress
                                            }
                                            onValueChange={async () => {
                                                this.setState({
                                                    showKeypad: !showKeypad
                                                });
                                                await updateSettings({
                                                    pos: {
                                                        ...settings.pos,
                                                        showKeypad: !showKeypad
                                                    }
                                                });
                                            }}
                                        />
                                    </View>
                                </ListItem>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.taxPercentage'
                                    )}
                                </Text>
                                <TextInput
                                    placeholder={'0'}
                                    value={taxPercentage}
                                    keyboardType="numeric"
                                    onChangeText={async (text: string) => {
                                        this.setState({
                                            taxPercentage: text
                                        });

                                        await updateSettings({
                                            pos: {
                                                ...settings.pos,
                                                taxPercentage: text
                                            }
                                        });
                                    }}
                                    suffix="%"
                                />
                            </>
                        )}
                    </View>
                    {posEnabled !== PosEnabled.Disabled &&
                        LIST_ITEMS.map((item, index) => (
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'none'
                                }}
                                onPress={() => navigation.navigate(item.path)}
                                key={`${item.label}-${index}`}
                            >
                                <ListItem.Content>
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {item.label}
                                    </ListItem.Title>
                                </ListItem.Content>
                                <Icon
                                    name="keyboard-arrow-right"
                                    color={themeColor('secondaryText')}
                                />
                            </ListItem>
                        ))}
                </ScrollView>
            </Screen>
        );
    }
}
