import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Switch from '../../../components/Switch';

interface ExpressGraphSyncProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface ExpressGraphSyncState {
    expressGraphSync: boolean | undefined;
    expressGraphSyncMobile: boolean | undefined;
    resetExpressGraphSyncOnStartup: boolean | undefined;
}

@inject('SettingsStore')
@observer
export default class ExpressGraphSync extends React.Component<
    ExpressGraphSyncProps,
    ExpressGraphSyncState
> {
    state = {
        expressGraphSync: false,
        expressGraphSyncMobile: false,
        resetExpressGraphSyncOnStartup: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            expressGraphSync: settings.expressGraphSync,
            expressGraphSyncMobile: settings.expressGraphSyncMobile,
            resetExpressGraphSyncOnStartup:
                settings.resetExpressGraphSyncOnStartup
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const {
            expressGraphSync,
            expressGraphSyncMobile,
            resetExpressGraphSyncOnStartup
        } = this.state;
        const { updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.ExpressGraphSync.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView>
                        <>
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                                hasTVPreferredFocus={false}
                                tvParallaxProperties={{}}
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.expressGraphSync'
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
                                        value={expressGraphSync}
                                        onValueChange={async () => {
                                            this.setState({
                                                expressGraphSync:
                                                    !expressGraphSync
                                            });
                                            await updateSettings({
                                                expressGraphSync:
                                                    !expressGraphSync
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
                                        'views.Settings.EmbeddedNode.expressGraphSync.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                                hasTVPreferredFocus={false}
                                tvParallaxProperties={{}}
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.expressGraphSyncMobile'
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
                                        value={expressGraphSyncMobile}
                                        onValueChange={async () => {
                                            this.setState({
                                                expressGraphSyncMobile:
                                                    !expressGraphSyncMobile
                                            });
                                            await updateSettings({
                                                expressGraphSyncMobile:
                                                    !expressGraphSyncMobile
                                            });
                                        }}
                                        disabled={!expressGraphSync}
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
                                        'views.Settings.EmbeddedNode.expressGraphSyncMobile.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
                        <>
                            <ListItem
                                containerStyle={{
                                    borderBottomWidth: 0,
                                    backgroundColor: 'transparent'
                                }}
                                hasTVPreferredFocus={false}
                                tvParallaxProperties={{}}
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'Lato-Regular'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.resetExpressGraphSyncOnStartup'
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
                                        value={resetExpressGraphSyncOnStartup}
                                        onValueChange={async () => {
                                            this.setState({
                                                resetExpressGraphSyncOnStartup:
                                                    !resetExpressGraphSyncOnStartup
                                            });
                                            await updateSettings({
                                                resetExpressGraphSyncOnStartup:
                                                    !resetExpressGraphSyncOnStartup
                                            });
                                        }}
                                        disabled={!expressGraphSync}
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
                                        'views.Settings.EmbeddedNode.resetExpressGraphSyncOnStartup.subtitle'
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
