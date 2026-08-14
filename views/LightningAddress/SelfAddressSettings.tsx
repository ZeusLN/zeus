import * as React from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import LoadingIndicator from '../../components/LoadingIndicator';

import SettingsStore from '../../stores/SettingsStore';
import LightningAddressStore from '../../stores/LightningAddressStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ZeusPayPlusSettings from '../../views/LightningAddress/ZeusPayPlusSettings';

interface SelfAddressSettingsProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
}

interface SelfAddressSettingsState {
    allowComments: boolean | undefined;
    zapReceiptsEnabled: boolean;
}

@inject('SettingsStore', 'LightningAddressStore')
@observer
export default class SelfAddressSettings extends React.Component<
    SelfAddressSettingsProps,
    SelfAddressSettingsState
> {
    constructor(props: SelfAddressSettingsProps) {
        super(props);

        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.state = {
            allowComments: settings.lightningAddress?.allowComments
                ? true
                : false,
            zapReceiptsEnabled:
                settings.lightningAddress?.zapReceiptsEnabled !== false
        };
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
        const { allowComments, zapReceiptsEnabled } = this.state;
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
                                    value={allowComments ?? true}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        const next = !allowComments;
                                        this.setState({
                                            allowComments: next
                                        });
                                        try {
                                            await update({
                                                allow_comments: next
                                            });
                                            await updateSettings({
                                                lightningAddress: {
                                                    ...settings.lightningAddress,
                                                    allowComments: next
                                                }
                                            });
                                        } catch (e) {
                                            this.setState({
                                                allowComments: !next
                                            });
                                        }
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
                                    infoModalText={[
                                        localeString(
                                            'views.Settings.LightningAddressSettings.zapReceiptsExplainer1'
                                        ),
                                        localeString(
                                            'views.Settings.LightningAddressSettings.zapReceiptsExplainer2'
                                        )
                                    ]}
                                >
                                    {localeString(
                                        'views.Settings.LightningAddressSettings.zapReceiptsEnabled'
                                    )}
                                </Text>
                            </View>
                            <View
                                style={{ alignSelf: 'center', marginLeft: 5 }}
                            >
                                <Switch
                                    value={zapReceiptsEnabled}
                                    disabled={
                                        SettingsStore.settingsUpdateInProgress
                                    }
                                    onValueChange={async () => {
                                        const next = !zapReceiptsEnabled;
                                        this.setState({
                                            zapReceiptsEnabled: next
                                        });
                                        try {
                                            await update({
                                                zap_receipts_enabled: next
                                            });
                                            await updateSettings({
                                                lightningAddress: {
                                                    ...settings.lightningAddress,
                                                    zapReceiptsEnabled: next
                                                }
                                            });
                                        } catch (e) {
                                            this.setState({
                                                zapReceiptsEnabled: !next
                                            });
                                        }
                                    }}
                                />
                            </View>
                        </View>
                        <View style={{ marginTop: 20 }}>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 15
                                }}
                                infoModalText={[
                                    localeString(
                                        'views.Settings.LightningAddressSettings.self.pushRequiredExplainer'
                                    )
                                ]}
                            >
                                {localeString(
                                    'views.Settings.LightningAddressSettings.self.pushRequired'
                                )}
                            </Text>
                        </View>
                        <ZeusPayPlusSettings navigation={navigation} />
                        {BackendUtils.supportsCashuWallet() &&
                            settings?.ecash?.enableCashu && (
                                <ListItem
                                    containerStyle={{
                                        backgroundColor: 'transparent',
                                        padding: 0,
                                        marginTop: 30
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
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
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
                            )}
                        <View style={{ marginTop: 40, marginBottom: 20 }}>
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
