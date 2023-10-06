import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';

import SettingsStore from '../../../stores/SettingsStore';
import LightningAddressStore from '../../../stores/LightningAddressStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Switch from '../../../components/Switch';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import LoadingIndicator from '../../../components/LoadingIndicator';

interface LightningAddressSettingsProps {
    navigation: any;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
}

interface LightningAddressSettingsState {
    automaticallyAccept: boolean | undefined;
    automaticallyRequestOlympusChannels: boolean | undefined;
    allowComments: boolean | undefined;
    verifyAllPaymentsWithNostr: boolean | undefined;
    nostrPrivateKey: string;
    nostrRelays: Array<string>;
}

@inject('SettingsStore', 'LightningAddressStore')
@observer
export default class LightningAddressSettings extends React.Component<
    LightningAddressSettingsProps,
    LightningAddressSettingsState
> {
    state = {
        automaticallyAccept: true,
        automaticallyRequestOlympusChannels: true,
        allowComments: true,
        verifyAllPaymentsWithNostr: false,
        nostrPrivateKey: '',
        nostrRelays: []
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            automaticallyAccept: settings.lightningAddress?.automaticallyAccept
                ? true
                : false,
            automaticallyRequestOlympusChannels: settings.lightningAddress
                ?.automaticallyRequestOlympusChannels
                ? true
                : false,
            allowComments: settings.lightningAddress?.allowComments
                ? true
                : false,
            verifyAllPaymentsWithNostr:
                settings.lightningAddress?.verifyAllPaymentsWithNostr,
            nostrPrivateKey: settings.lightningAddress?.nostrPrivateKey || '',
            nostrRelays: settings.lightningAddress?.nostrRelays || []
        });
    }

    render() {
        const { navigation, SettingsStore, LightningAddressStore } = this.props;
        const {
            automaticallyAccept,
            automaticallyRequestOlympusChannels,
            allowComments,
            verifyAllPaymentsWithNostr,
            nostrPrivateKey,
            nostrRelays
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
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        rightComponent={loading && <LoadingIndicator />}
                        navigation={navigation}
                    />
                    <View style={{ margin: 5 }}>
                        {error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        <ListItem containerStyle={styles.listItem}>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
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
                                                automaticallyRequestOlympusChannels,
                                                allowComments,
                                                verifyAllPaymentsWithNostr,
                                                nostrPrivateKey,
                                                nostrRelays
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </ListItem>
                        <ListItem containerStyle={styles.listItem}>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
                                    width: '85%'
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.automaticallyRequestOlympusChannels'
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
                                    value={automaticallyRequestOlympusChannels}
                                    onValueChange={async () => {
                                        try {
                                            await update({
                                                request_channels:
                                                    !automaticallyRequestOlympusChannels
                                            }).then(async () => {
                                                this.setState({
                                                    automaticallyRequestOlympusChannels:
                                                        !automaticallyRequestOlympusChannels
                                                });
                                                await updateSettings({
                                                    lightningAddress: {
                                                        enabled,
                                                        automaticallyAccept,
                                                        automaticallyRequestOlympusChannels:
                                                            !automaticallyRequestOlympusChannels,
                                                        allowComments,
                                                        verifyAllPaymentsWithNostr,
                                                        nostrPrivateKey,
                                                        nostrRelays
                                                    }
                                                });
                                            });
                                        } catch (e) {}
                                    }}
                                />
                            </View>
                        </ListItem>
                        <ListItem containerStyle={styles.listItem}>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
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
                                                        automaticallyRequestOlympusChannels,
                                                        allowComments:
                                                            !allowComments,
                                                        verifyAllPaymentsWithNostr,
                                                        nostrPrivateKey,
                                                        nostrRelays
                                                    }
                                                });
                                            });
                                        } catch (e) {}
                                    }}
                                />
                            </View>
                        </ListItem>
                        <ListItem containerStyle={styles.listItem}>
                            <ListItem.Title
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
                                    width: '85%'
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.verifyAllPaymentsWithNostr'
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
                                    value={verifyAllPaymentsWithNostr}
                                    onValueChange={async () => {
                                        this.setState({
                                            verifyAllPaymentsWithNostr:
                                                !verifyAllPaymentsWithNostr
                                        });
                                        await updateSettings({
                                            lightningAddress: {
                                                enabled,
                                                automaticallyAccept,
                                                automaticallyRequestOlympusChannels,
                                                allowComments,
                                                verifyAllPaymentsWithNostr:
                                                    !verifyAllPaymentsWithNostr,
                                                nostrPrivateKey,
                                                nostrRelays
                                            }
                                        });
                                    }}
                                />
                            </View>
                        </ListItem>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.verifyAllPaymentsWithNostr.subtitle1'
                                )}
                            </Text>
                        </View>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.verifyAllPaymentsWithNostr.subtitle2'
                                )}
                            </Text>
                        </View>
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
                                        fontFamily: 'Lato-Regular'
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
                    </View>
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
