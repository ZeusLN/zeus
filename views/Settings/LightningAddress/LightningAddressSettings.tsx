import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Text from '../../../components/Text';
import DropdownSetting from '../../../components/DropdownSetting';
import Screen from '../../../components/Screen';
import Switch from '../../../components/Switch';
import Header from '../../../components/Header';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import LoadingIndicator from '../../../components/LoadingIndicator';
import { StackNavigationProp } from '@react-navigation/stack';

import SettingsStore, {
    NOTIFICATIONS_PREF_KEYS,
    AUTOMATIC_ATTESTATION_KEYS
} from '../../../stores/SettingsStore';
import LightningAddressStore from '../../../stores/LightningAddressStore';
import NodeInfoStore from '../../../stores/NodeInfoStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import { checkAndRequestNotificationPermissions } from '../../../utils/NotificationUtils';

interface LightningAddressSettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
    NodeInfoStore: NodeInfoStore;
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

@inject('SettingsStore', 'LightningAddressStore', 'NodeInfoStore')
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
        const { SettingsStore, NodeInfoStore } = this.props;
        const lightningAddressGlobal =
            SettingsStore.settings.lightningAddressGlobal;

        this.setState({
            // Global settings
            automaticallyAccept: lightningAddressGlobal.automaticallyAccept,
            automaticallyAcceptAttestationLevel:
                lightningAddressGlobal.automaticallyAcceptAttestationLevel,
            routeHints: lightningAddressGlobal.routeHints,
            allowComments: lightningAddressGlobal.allowComments,
            nostrRelays: lightningAddressGlobal.nostrRelays,
            notifications: lightningAddressGlobal.notifications,
            // Node-specific settings
            nostrPrivateKey:
                SettingsStore.settings.lightningAddressByPubkey?.[
                    NodeInfoStore.nodeInfo.identity_pubkey
                ].nostrPrivateKey ?? ''
        });
    }

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
                                        color: themeColor('secondaryText'),
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
                                    onValueChange={async () => {
                                        this.setState({
                                            automaticallyAccept:
                                                !automaticallyAccept
                                        });
                                        await updateSettings({
                                            lightningAddressGlobal: {
                                                ...settings.lightningAddressGlobal,
                                                automaticallyAccept:
                                                    !automaticallyAccept
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </View>
                        <View style={{ marginTop: 20 }}>
                            <DropdownSetting
                                title={localeString(
                                    'views.Settings.LightningAddressSettings.automaticallyAcceptAttestationLevel'
                                )}
                                selectedValue={
                                    automaticallyAcceptAttestationLevel
                                }
                                onValueChange={async (value: number) => {
                                    this.setState({
                                        automaticallyAcceptAttestationLevel:
                                            value
                                    });
                                    await updateSettings({
                                        lightningAddressGlobal: {
                                            ...settings.lightningAddressGlobal,
                                            automaticallyAcceptAttestationLevel:
                                                value
                                        }
                                    });
                                }}
                                values={AUTOMATIC_ATTESTATION_KEYS}
                                disabled={!automaticallyAccept}
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
                                        color: themeColor('secondaryText'),
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
                                    onValueChange={async () => {
                                        this.setState({
                                            routeHints: !routeHints
                                        });
                                        await updateSettings({
                                            lightningAddressGlobal: {
                                                ...settings.lightningAddressGlobal,
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
                                        color: themeColor('secondaryText'),
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
                                                    lightningAddressGlobal: {
                                                        ...settings.lightningAddressGlobal,
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
                                selectedValue={notifications}
                                onValueChange={async (value: number) => {
                                    if (value === 1) {
                                        const permissionGranted =
                                            await checkAndRequestNotificationPermissions();
                                        if (!permissionGranted) return;
                                    }

                                    try {
                                        await update({
                                            notifications: value
                                        }).then(async () => {
                                            this.setState({
                                                notifications: value
                                            });
                                            await updateSettings({
                                                lightningAddressGlobal: {
                                                    ...settings.lightningAddressGlobal,
                                                    notifications: value
                                                }
                                            });
                                        });
                                    } catch (e) {}
                                }}
                                values={NOTIFICATIONS_PREF_KEYS}
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
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString('nostr.keys')}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
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
                                        color: themeColor('secondaryText'),
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
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 20
                            }}
                            onPress={() => navigation.navigate('ChangeAddress')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddress.ChangeAddress'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
