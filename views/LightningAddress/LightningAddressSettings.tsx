import * as React from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import {
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';
import LoadingIndicator from '../../components/LoadingIndicator';

import SettingsStore from '../../stores/SettingsStore';
import LightningAddressStore from '../../stores/LightningAddressStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ZeusPayPlusSettings from '../../views/LightningAddress/ZeusPayPlusSettings';

// Settings for a retired Zaplocker address: the address can only be
// switched to another type or deleted.
interface LightningAddressSettingsProps {
    navigation: NativeStackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    LightningAddressStore: LightningAddressStore;
}

@inject('SettingsStore', 'LightningAddressStore')
@observer
export default class LightningAddressSettings extends React.Component<
    LightningAddressSettingsProps,
    {}
> {
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
                        LightningAddressStore.deleteAddress()
                            .then(() => {
                                this.props.navigation.goBack();
                            })
                            .catch((e) =>
                                console.log(
                                    'Error deleting Lightning address',
                                    e
                                )
                            );
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    render() {
        const { navigation, SettingsStore, LightningAddressStore } = this.props;
        const { settings } = SettingsStore;
        const { loading, error_msg } = LightningAddressStore;

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
                        <View style={{ marginTop: 20 }}>
                            <WarningMessage
                                message={localeString(
                                    'zeuspay.zaplocker.retired'
                                )}
                            />
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
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                padding: 0,
                                marginTop: 30
                            }}
                            onPress={() =>
                                navigation.navigate(
                                    'CreateNWCLightningAddress',
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
                                        'views.Settings.LightningAddress.switchToNWC'
                                    )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('text')}
                            />
                        </ListItem>
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
