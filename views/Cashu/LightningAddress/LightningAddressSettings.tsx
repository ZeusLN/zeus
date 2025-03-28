import * as React from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Switch from '../../../components/Switch';
import Text from '../../../components/Text';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import LoadingIndicator from '../../../components/LoadingIndicator';

import SettingsStore from '../../../stores/SettingsStore';
import LightningAddressStore from '../../../stores/LightningAddressStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface CashuLightningAddressSettingsProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
}

interface CashuLightningAddressSettingsState {
    automaticallyAccept: boolean | undefined;
    allowComments: boolean | undefined;
}

@inject('SettingsStore', 'LightningAddressStore')
@observer
export default class CashuLightningAddressSettings extends React.Component<
    CashuLightningAddressSettingsProps,
    CashuLightningAddressSettingsState
> {
    state = {
        automaticallyAccept: true,
        allowComments: true
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            automaticallyAccept: settings.lightningAddress?.automaticallyAccept
                ? true
                : false,
            allowComments: settings.lightningAddress?.allowComments
                ? true
                : false
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
        const { automaticallyAccept, allowComments } = this.state;
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
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 20,
                                marginBottom: 20
                            }}
                            onPress={() =>
                                navigation.navigate('CashuChangeAddress')
                            }
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
