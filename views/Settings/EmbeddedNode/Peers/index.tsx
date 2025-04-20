import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../../../components/Screen';
import Header from '../../../../components/Header';

import SettingsStore from '../../../../stores/SettingsStore';

import { localeString } from '../../../../utils/LocaleUtils';
import { themeColor } from '../../../../utils/ThemeUtils';
interface PeersProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class Peers extends React.Component<PeersProps, {}> {
    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings, embeddedLndNetwork }: any = SettingsStore;
        const {
            neutrinoPeersMainnet,
            neutrinoPeersTestnet,
            zeroConfPeers,
            dontAllowOtherPeers
        } = settings;

        const neutrinoPeers =
            embeddedLndNetwork === 'Mainnet'
                ? neutrinoPeersMainnet
                : neutrinoPeersTestnet;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: `${localeString(
                                'general.peers'
                            )[0].toUpperCase()}${localeString(
                                'general.peers'
                            ).slice(1)}`,
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
                            onPress={() => navigation.navigate('PeersList')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString('general.connectedPeers')}
                                </ListItem.Title>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString('general.viewConnectedPeers')}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
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
                                    'views.Settings.EmbeddedNode.Peers.connectedPeersSubtitle'
                                )}
                            </Text>
                        </View>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                            onPress={() => navigation.navigate('NeutrinoPeers')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.NeutrinoPeers.title'
                                    )}
                                </ListItem.Title>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {neutrinoPeers && neutrinoPeers.length > 0
                                        ? `${neutrinoPeers.length} ${
                                              neutrinoPeers.length > 1
                                                  ? localeString(
                                                        'general.peers'
                                                    ).toLowerCase()
                                                  : localeString(
                                                        'general.peer'
                                                    ).toLowerCase()
                                          } ${localeString(
                                              'general.selected'
                                          ).toLowerCase()}.`
                                        : `${localeString(
                                              'general.noneSelected'
                                          )}. ${localeString(
                                              'general.zeusDefaults'
                                          ).replace('Zeus', 'ZEUS')}.`}{' '}
                                    {dontAllowOtherPeers
                                        ? localeString(
                                              'views.Settings.EmbeddedNode.NeutrinoPeers.notAllowingOtherPeers'
                                          )
                                        : localeString(
                                              'views.Settings.EmbeddedNode.NeutrinoPeers.allowingOtherPeers'
                                          )}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
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
                                    'views.Settings.EmbeddedNode.NeutrinoPeers.subtitle'
                                )}
                            </Text>
                        </View>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                            onPress={() => navigation.navigate('ZeroConfPeers')}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.ZeroConfPeers.title'
                                    )}
                                </ListItem.Title>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {zeroConfPeers && zeroConfPeers.length > 0
                                        ? `${zeroConfPeers.length} ${
                                              zeroConfPeers.length > 1
                                                  ? localeString(
                                                        'general.peers'
                                                    ).toLowerCase()
                                                  : localeString(
                                                        'general.peer'
                                                    ).toLowerCase()
                                          } ${localeString(
                                              'general.selected'
                                          ).toLowerCase()}.`
                                        : `${localeString(
                                              'general.noneSelected'
                                          )}.`}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
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
                                    'views.Settings.EmbeddedNode.ZeroConfPeers.subtitle'
                                )}
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
