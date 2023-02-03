import * as React from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { Header, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import DropdownSetting from './../../components/DropdownSetting';
import {
    ErrorMessage,
    WarningMessage
} from './../../components/SuccessErrorMessage';
import Switch from './../../components/Switch';
import TextInput from './../../components/TextInput';

import SettingsStore, {
    DEFAULT_FIAT,
    POS_CONF_PREF_KEYS
} from './../../stores/SettingsStore';

interface PointOfSaleProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface PointOfSaleState {
    squareEnabled: boolean;
    squareAccessToken: string;
    squareLocationId: string;
    merchantName: string;
    confirmationPreference: string;
    disableTips: boolean;
    squareDevMode: boolean;
}

@inject('SettingsStore')
@observer
export default class PointOfSale extends React.Component<
    PointOfSaleProps,
    PointOfSaleState
> {
    state = {
        squareEnabled: false,
        squareAccessToken: '',
        squareLocationId: '',
        merchantName: '',
        confirmationPreference: 'lnOnly',
        disableTips: false,
        squareDevMode: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { getSettings } = SettingsStore;
        const settings = await getSettings();

        this.setState({
            squareEnabled:
                (settings.pos && settings.pos.squareEnabled) || false,
            squareAccessToken:
                (settings.pos && settings.pos.squareAccessToken) || '',
            squareLocationId:
                (settings.pos && settings.pos.squareLocationId) || '',
            merchantName: (settings.pos && settings.pos.merchantName) || '',
            confirmationPreference:
                (settings.pos && settings.pos.confirmationPreference) ||
                'lnOnly',
            disableTips: (settings.pos && settings.pos.disableTips) || false,
            squareDevMode: (settings.pos && settings.pos.squareDevMode) || false
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
            squareEnabled,
            squareAccessToken,
            squareLocationId,
            merchantName,
            confirmationPreference,
            disableTips,
            squareDevMode
        } = this.state;
        const { updateSettings, settings }: any = SettingsStore;
        const { passphrase, pin, fiat } = settings;

        const LIST_ITEMS = [
            {
                label: localeString('views.Settings.POS.recon'),
                path: 'PointOfSaleRecon'
            }
        ];

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() =>
                    navigation.navigate('Settings', {
                        refresh: true
                    })
                }
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('general.pos'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                {fiat === DEFAULT_FIAT ? (
                    <View style={{ flex: 1, padding: 15 }}>
                        <ErrorMessage
                            message={localeString(
                                'pos.views.Settings.PointOfSale.currencyError'
                            )}
                        />
                    </View>
                ) : (
                    <ScrollView style={{ flex: 1 }}>
                        <View style={{ padding: 15 }}>
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
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: themeColor('background')
                                }}
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular',
                                        left: -10
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.POS.enableSquare'
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
                                        value={squareEnabled}
                                        onValueChange={async () => {
                                            this.setState({
                                                squareEnabled: !squareEnabled
                                            });
                                            await updateSettings({
                                                pos: {
                                                    squareAccessToken,
                                                    squareLocationId,
                                                    merchantName,
                                                    squareEnabled:
                                                        !squareEnabled,
                                                    confirmationPreference,
                                                    disableTips,
                                                    squareDevMode
                                                }
                                            });
                                        }}
                                    />
                                </View>
                            </ListItem>

                            {squareEnabled && (
                                <>
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'Lato-Regular'
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
                                                    squareEnabled,
                                                    squareAccessToken: text,
                                                    squareLocationId,
                                                    merchantName,
                                                    confirmationPreference,
                                                    disableTips,
                                                    squareDevMode
                                                }
                                            });
                                        }}
                                    />

                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'Lato-Regular'
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
                                                    squareEnabled,
                                                    squareAccessToken,
                                                    squareLocationId: text,
                                                    merchantName,
                                                    confirmationPreference,
                                                    disableTips,
                                                    squareDevMode
                                                }
                                            });
                                        }}
                                    />

                                    <Text
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'Lato-Regular'
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
                                                    squareEnabled,
                                                    squareAccessToken,
                                                    squareLocationId,
                                                    merchantName: text,
                                                    confirmationPreference,
                                                    disableTips,
                                                    squareDevMode
                                                }
                                            });
                                        }}
                                    />

                                    <DropdownSetting
                                        title={localeString(
                                            'views.Settings.POS.confPref'
                                        )}
                                        selectedValue={confirmationPreference}
                                        onValueChange={async (
                                            value: string
                                        ) => {
                                            this.setState({
                                                confirmationPreference: value
                                            });
                                            await updateSettings({
                                                pos: {
                                                    squareEnabled,
                                                    squareAccessToken,
                                                    squareLocationId,
                                                    merchantName,
                                                    confirmationPreference:
                                                        value,
                                                    disableTips,
                                                    squareDevMode
                                                }
                                            });
                                        }}
                                        values={POS_CONF_PREF_KEYS}
                                    />

                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                themeColor('background')
                                        }}
                                    >
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily: 'Lato-Regular',
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
                                                onValueChange={async () => {
                                                    this.setState({
                                                        disableTips:
                                                            !disableTips
                                                    });
                                                    await updateSettings({
                                                        pos: {
                                                            squareAccessToken,
                                                            squareLocationId,
                                                            squareEnabled,
                                                            merchantName,
                                                            confirmationPreference,
                                                            disableTips:
                                                                !disableTips,
                                                            squareDevMode
                                                        }
                                                    });
                                                }}
                                            />
                                        </View>
                                    </ListItem>

                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                themeColor('background')
                                        }}
                                    >
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily: 'Lato-Regular',
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
                                                onValueChange={async () => {
                                                    this.setState({
                                                        squareDevMode:
                                                            !squareDevMode
                                                    });
                                                    await updateSettings({
                                                        pos: {
                                                            squareAccessToken,
                                                            squareLocationId,
                                                            squareEnabled,
                                                            merchantName,
                                                            confirmationPreference,
                                                            disableTips,
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
                        </View>
                        {squareEnabled && (
                            <FlatList
                                data={LIST_ITEMS}
                                renderItem={({ item }) => (
                                    <ListItem
                                        containerStyle={{
                                            borderBottomWidth: 0,
                                            backgroundColor:
                                                themeColor('background')
                                        }}
                                        onPress={() =>
                                            navigation.navigate(item.path)
                                        }
                                    >
                                        <ListItem.Content>
                                            <ListItem.Title
                                                style={{
                                                    color: themeColor('text'),
                                                    fontFamily: 'Lato-Regular'
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
                                )}
                                keyExtractor={(item, index) =>
                                    `${item.label}-${index}`
                                }
                            />
                        )}
                    </ScrollView>
                )}
            </View>
        );
    }
}
