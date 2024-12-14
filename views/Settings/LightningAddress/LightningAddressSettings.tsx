import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import { Row } from '../../../components/layout/Row';
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

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

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
            notifications: settings.lightningAddress?.notifications || 1
        });
    }

    render() {
        const { navigation, SettingsStore, LightningAddressStore } = this.props;
        const {
            automaticallyAccept,
            automaticallyAcceptAttestationLevel,
            routeHints,
            allowComments,
            nostrPrivateKey,
            nostrRelays,
            notifications
        } = this.state;
        const { updateSettings, settings }: any = SettingsStore;
        const enabled = settings?.lightningAddress?.enabled;
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
                            loading ? <LoadingIndicator size={32} /> : <></>
                        }
                        navigation={navigation}
                    />
                    <ScrollView style={{ margin: 5 }}>
                        {error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        <ListItem containerStyle={styles.listItem}>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    width: '85%'
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.automaticallyAccept'
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
                                    value={automaticallyAccept}
                                    onValueChange={async () => {
                                        this.setState({
                                            automaticallyAccept:
                                                !automaticallyAccept
                                        });
                                        await updateSettings({
                                            lightningAddress: {
                                                enabled,
                                                automaticallyAccept:
                                                    !automaticallyAccept,
                                                automaticallyAcceptAttestationLevel,
                                                automaticallyRequestOlympusChannels:
                                                    false, // deprecated
                                                routeHints,
                                                allowComments,
                                                nostrPrivateKey,
                                                nostrRelays,
                                                notifications
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </ListItem>
                        <View
                            style={{
                                margin: 5,
                                marginLeft: 15,
                                marginRight: 15
                            }}
                        >
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
                                        lightningAddress: {
                                            enabled,
                                            automaticallyAccept,
                                            automaticallyAcceptAttestationLevel:
                                                value,
                                            automaticallyRequestOlympusChannels:
                                                false, // deprecated
                                            routeHints,
                                            allowComments,
                                            nostrPrivateKey,
                                            nostrRelays,
                                            notifications
                                        }
                                    });
                                }}
                                values={AUTOMATIC_ATTESTATION_KEYS}
                                disabled={!automaticallyAccept}
                            />
                        </View>
                        <ListItem containerStyle={styles.listItem}>
                            <Row align="flex-end">
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
                                <View style={{ flex: 1 }}>
                                    <Switch
                                        value={routeHints}
                                        onValueChange={async () => {
                                            this.setState({
                                                routeHints: !routeHints
                                            });
                                            await updateSettings({
                                                lightningAddress: {
                                                    enabled,
                                                    automaticallyAccept,
                                                    automaticallyAcceptAttestationLevel,
                                                    automaticallyRequestOlympusChannels:
                                                        false, // deprecated
                                                    routeHints: !routeHints,
                                                    allowComments,
                                                    nostrPrivateKey,
                                                    nostrRelays,
                                                    notifications
                                                }
                                            });
                                        }}
                                    />
                                </View>
                            </Row>
                        </ListItem>
                        <ListItem containerStyle={styles.listItem}>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    width: '85%'
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.allowComments'
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
                                                    lightningAddress: {
                                                        enabled,
                                                        automaticallyAccept,
                                                        automaticallyAcceptAttestationLevel,
                                                        automaticallyRequestOlympusChannels:
                                                            false, // deprecated
                                                        routeHints,
                                                        allowComments:
                                                            !allowComments,
                                                        nostrPrivateKey,
                                                        nostrRelays,
                                                        notifications
                                                    }
                                                });
                                            });
                                        } catch (e) {}
                                    }}
                                />
                            </View>
                        </ListItem>
                        <View
                            style={{
                                margin: 5,
                                marginLeft: 15,
                                marginRight: 15
                            }}
                        >
                            <DropdownSetting
                                title={localeString(
                                    'views.Settings.LightningAddressSettings.notifications'
                                )}
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
                                                    enabled,
                                                    automaticallyAccept,
                                                    automaticallyAcceptAttestationLevel,
                                                    automaticallyRequestOlympusChannels:
                                                        false, // deprecated
                                                    routeHints,
                                                    allowComments,
                                                    nostrPrivateKey,
                                                    nostrRelays,
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
                                backgroundColor: 'transparent'
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
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
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
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                            onPress={() => navigation.navigate('ChangeAddress')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
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

const styles = StyleSheet.create({
    listItem: {
        borderBottomWidth: 0,
        backgroundColor: 'transparent'
    }
});
