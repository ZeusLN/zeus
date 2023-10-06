import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Screen from '../../../../components/Screen';
import Header from '../../../../components/Header';

import SettingsStore from '../../../../stores/SettingsStore';

import { localeString } from '../../../../utils/LocaleUtils';
import { themeColor } from '../../../../utils/ThemeUtils';
interface PeersProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

@inject('SettingsStore')
@observer
export default class Peers extends React.Component<PeersProps, {}> {
    render() {
        const { navigation, SettingsStore } = this.props;
        const { settings }: any = SettingsStore;
        const { neutrinoPeers, zeroConfPeers, dontAllowOtherPeers } = settings;

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
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent'
                            }}
                            onPress={() => navigation.navigate('NeutrinoPeers')}
                            hasTVPreferredFocus={false}
                            tvParallaxProperties={{}}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.NeutrinoPeers.title'
                                    )}
                                </ListItem.Title>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
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
                                          )}.`}{' '}
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
                                tvParallaxProperties={{}}
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
                            hasTVPreferredFocus={false}
                            tvParallaxProperties={{}}
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.ZeroConfPeers.title'
                                    )}
                                </ListItem.Title>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
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
                                tvParallaxProperties={{}}
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
