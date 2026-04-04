import * as React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Icon, ListItem } from '@rneui/themed';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';

import CashuStore from '../../stores/CashuStore';
import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface CashuToolsProps {
    navigation: NativeStackNavigationProp<any, any>;
    CashuStore: CashuStore;
    SettingsStore: SettingsStore;
}

@inject('CashuStore', 'SettingsStore')
@observer
export default class CashuTools extends React.Component<CashuToolsProps, {}> {
    handleDeleteData = () => {
        Alert.alert(
            localeString('views.Tools.cashu.deleteData.confirmTitle'),
            localeString('views.Tools.cashu.deleteData.confirmMessage'),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('general.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        await this.props.CashuStore.deleteCashuData();
                    }
                }
            ],
            { cancelable: false }
        );
    };

    render() {
        const { navigation, CashuStore, SettingsStore } = this.props;
        const { seedVersion } = CashuStore;
        const isLdk = SettingsStore.implementation === 'ldk-node';
        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('views.Tools.cashu'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                            onPress={() => navigation.navigate('TokenVault')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString('cashu.tokenVault.title')}
                                </ListItem.Title>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString('cashu.tokenVault.subtitle')}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>

                        {seedVersion === 'v2-bip39' && !isLdk && (
                            <>
                                <ListItem
                                    containerStyle={{
                                        backgroundColor: 'transparent'
                                    }}
                                    onPress={() =>
                                        navigation.navigate('CashuSeed')
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
                                                'views.Settings.Seed.title'
                                            )}
                                        </ListItem.Title>
                                        <ListItem.Title
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                ),
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            BIP-39
                                        </ListItem.Title>
                                    </ListItem.Content>
                                    <Icon
                                        name="keyboard-arrow-right"
                                        color={themeColor('secondaryText')}
                                    />
                                </ListItem>
                            </>
                        )}

                        {!isLdk && (
                            <ListItem
                                containerStyle={{
                                    backgroundColor: 'transparent'
                                }}
                                onPress={() =>
                                    navigation.navigate('LegacySeedRecovery')
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
                                            'views.Cashu.LegacySeedRecovery.title'
                                        )}
                                    </ListItem.Title>
                                    <ListItem.Title
                                        style={{
                                            color: themeColor('secondaryText'),
                                            fontFamily: 'PPNeueMontreal-Book'
                                        }}
                                    >
                                        {localeString(
                                            'views.Cashu.LegacySeedRecovery.subtitle'
                                        )}
                                    </ListItem.Title>
                                </ListItem.Content>
                                <Icon
                                    name="keyboard-arrow-right"
                                    color={themeColor('secondaryText')}
                                />
                            </ListItem>
                        )}

                        <View style={{ marginTop: 25 }}>
                            <Button
                                title={localeString(
                                    'views.Settings.Ecash.cashuTroubleshooting'
                                )}
                                onPress={() => {
                                    UrlUtils.goToUrl(
                                        'https://docs.zeusln.app/cashu#i-get-an-error-saying-outputs-have-already-been-signed-before-or-already-spent-what-should-i-do'
                                    );
                                }}
                                icon={{
                                    name: 'life-buoy',
                                    type: 'feather',
                                    size: 25
                                }}
                                secondary
                            />
                        </View>

                        <>
                            <View style={{ marginTop: 25 }}>
                                <Button
                                    title={localeString(
                                        'views.Tools.cashu.deleteData'
                                    )}
                                    onPress={this.handleDeleteData}
                                    warning
                                />
                            </View>
                            <View
                                style={{
                                    margin: 10,
                                    marginTop: 15
                                }}
                            >
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.Tools.cashu.deleteData.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
