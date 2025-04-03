import * as React from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import LoadingIndicator from '../../components/LoadingIndicator';

import SettingsStore, {
    NOTIFICATIONS_PREF_KEYS,
    AUTOMATIC_ATTESTATION_KEYS
} from '../../stores/SettingsStore';
import LightningAddressStore from '../../stores/LightningAddressStore';

import { localeString } from '../../utils/LocaleUtils';
import { restartNeeded } from '../../utils/RestartUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ZeusPayPlusSettings from '../../views/LightningAddress/ZeusPayPlusSettings';

interface LightningAddressSettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
}

interface LightningAddressSettingsState {
    automaticallyAccept: boolean | undefined;
    automaticallyAcceptAttestationLevel: number;
    routeHints: boolean | undefined;
    allowComments: boolean | undefined;
    nostrPrivateKey: string;
    nostrRelays: Array<string>;
    notifications: number;
}

@inject('SettingsStore', 'LightningAddressStore')
@observer
export default class LightningAddressSettings extends React.Component<
    LightningAddressSettingsProps,
    LightningAddressSettingsState
> {
    state = {
        automaticallyAccept: true,
        automaticallyAcceptAttestationLevel: 2,
        routeHints: false,
        allowComments: true,
        nostrPrivateKey: '',
        nostrRelays: [],
        notifications: 1
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            automaticallyAccept: settings.lightningAddress?.automaticallyAccept
                ? true
                : false,
            automaticallyAcceptAttestationLevel: settings.lightningAddress
                ?.automaticallyAcceptAttestationLevel
                ? settings.lightningAddress.automaticallyAcceptAttestationLevel
                : 2,
            routeHints: settings.lightningAddress?.routeHints ? true : false,
            allowComments: settings.lightningAddress?.allowComments
                ? true
                : false,
            nostrPrivateKey: settings.lightningAddress?.nostrPrivateKey || '',
            nostrRelays: settings.lightningAddress?.nostrRelays || [],
            notifications:
                settings.lightningAddress?.notifications !== undefined
                    ? settings.lightningAddress.notifications
                    : 1
        });
    }

    confirmDelete = () => {
        Alert.alert(
            localeString('views.Settings.LightningAddress.deleteAddress'),
            localeString(
                'views.Settings.LightningAddress.deleteAddressConfirm'
            ),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('general.delete'),
                    onPress: () => {
                        const { LightningAddressStore } = this.props;
                        LightningAddressStore.deleteAddress().then(() => {
                            this.props.navigation.goBack();
                        });
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    render() {
        const { navigation, SettingsStore, LightningAddressStore } = this.props;
        const {
            automaticallyAccept,
            automaticallyAcceptAttestationLevel,
            routeHints,
            allowComments,
            nostrRelays,
            notifications
        } = this.state;
        const { updateSettings, settings }: any = SettingsStore;
        const { loading, update, error_msg } = LightningAddressStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.LightningAddressSettings.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        rightComponent={
                            loading ? (
                                <View>
                                    <LoadingIndicator size={30} />
                                </View>
                            ) : undefined
                        }
                        navigation={navigation}
                    />
                    <ScrollView style={{ paddingHorizontal: 15, marginTop: 5 }}>
                        {error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 20
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontSize: 17,
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddressSettings.automaticallyAccept'
                                    )}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={automaticallyAccept}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        this.setState({
                                            automaticallyAccept:
                                                !automaticallyAccept
                                        });
                                        await updateSettings({
                                            lightningAddress: {
                                                ...settings.lightningAddress,
                                                automaticallyAccept:
                                                    !automaticallyAccept
                                            }
                                        });
                                        restartNeeded();
                                    }}
                                />
                            </View>
                        </View>
                        <View style={{ marginTop: 20 }}>
                            <DropdownSetting
                                title={localeString(
                                    'views.Settings.LightningAddressSettings.automaticallyAcceptAttestationLevel'
                                )}
                                titleColor={themeColor('text')}
                                selectedValue={
                                    automaticallyAcceptAttestationLevel
                                }
                                onValueChange={async (value: number) => {
                                    this.setState({
                                        automaticallyAcceptAttestationLevel:
                                            value
                                    });
                                    await updateSettings({
                                        lightningAddress: {
                                            ...settings.lightningAddress,
                                            automaticallyAcceptAttestationLevel:
                                                value
                                        }
                                    });
                                    restartNeeded();
                                }}
                                values={AUTOMATIC_ATTESTATION_KEYS}
                                disabled={
                                    !automaticallyAccept ||
                                    SettingsStore.settingsUpdateInProgress
                                }
                            />
                        </View>
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 20
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 17
                                    }}
                                    infoModalText={[
                                        localeString(
                                            'views.Settings.LightningAddressSettings.routeHintsExplainer1'
                                        ),
                                        localeString(
                                            'views.Settings.LightningAddressSettings.routeHintsExplainer2'
                                        )
                                    ]}
                                >
                                    {localeString('views.Receive.routeHints')}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={routeHints}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        this.setState({
                                            routeHints: !routeHints
                                        });
                                        await updateSettings({
                                            lightningAddress: {
                                                ...settings.lightningAddress,
                                                routeHints: !routeHints
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </View>
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 20
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 17
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddressSettings.allowComments'
                                    )}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={allowComments}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        try {
                                            await update({
                                                allow_comments: !allowComments
                                            }).then(async () => {
                                                this.setState({
                                                    allowComments:
                                                        !allowComments
                                                });
                                                await updateSettings({
                                                    lightningAddress: {
                                                        ...settings.lightningAddress,
                                                        allowComments:
                                                            !allowComments
                                                    }
                                                });
                                            });
                                        } catch (e) {}
                                    }}
                                />
                            </View>
                        </View>
                        <View style={{ marginTop: 20 }}>
                            <DropdownSetting
                                title={localeString(
                                    'views.Settings.LightningAddressSettings.notifications'
                                )}
                                titleColor={themeColor('text')}
                                selectedValue={notifications}
                                onValueChange={async (value: number) => {
                                    try {
                                        await update({
                                            notifications: value
                                        }).then(async () => {
                                            this.setState({
                                                notifications: value
                                            });
                                            await updateSettings({
                                                lightningAddress: {
                                                    ...settings.lightningAddress,
                                                    notifications: value
                                                }
                                            });
                                        });
                                    } catch (e) {}
                                }}
                                values={NOTIFICATIONS_PREF_KEYS}
                                disabled={
                                    SettingsStore.settingsUpdateInProgress
                                }
                            />
                        </View>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 20
                            }}
                            onPress={() => navigation.navigate('NostrKeys')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString('nostr.keys')}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('text')}
                            />
                        </ListItem>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 20
                            }}
                            onPress={() => navigation.navigate('NostrRelays')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {`${localeString(
                                        'views.Settings.Nostr.relays'
                                    )} (${nostrRelays?.length || 0})`}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('text')}
                            />
                        </ListItem>
                        <ZeusPayPlusSettings navigation={navigation} />
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 20,
                                marginBottom: 20
                            }}
                            onPress={() =>
                                navigation.navigate(
                                    'CreateCashuLightningAddress',
                                    { switchTo: true }
                                )
                            }
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddress.switchToCashu'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('text')}
                            />
                        </ListItem>
                        <View style={{ marginTop: 20, marginBottom: 20 }}>
                            <Button
                                title={localeString(
                                    'views.Settings.LightningAddress.deleteAddress'
                                )}
                                onPress={this.confirmDelete}
                                warning
                            />
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
