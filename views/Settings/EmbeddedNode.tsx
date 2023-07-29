import * as React from 'react';
import { Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Header from '../../components/Header';

import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import Switch from '../../components/Switch';

import { resetMissionControl } from '../../lndmobile';

interface EmbeddedNodeProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface EmbeddedNodeState {
    expressGraphSync: boolean | undefined;
    expressGraphSyncMobile: boolean | undefined;
    resetExpressGraphSyncOnStartup: boolean | undefined;
    resetMissionControlSuccess: boolean | undefined;
}

@inject('SettingsStore')
@observer
export default class EmbeddedNode extends React.Component<
    EmbeddedNodeProps,
    EmbeddedNodeState
> {
    state = {
        expressGraphSync: false,
        expressGraphSyncMobile: false,
        resetExpressGraphSyncOnStartup: false,
        resetMissionControlSuccess: false
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
            resetExpressGraphSyncOnStartup,
            resetMissionControlSuccess
        } = this.state;
        const { updateSettings, embeddedLndNetwork }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    {embeddedLndNetwork === 'Mainnet' && (
                        <>
                            <>
                                <ListItem
                                    containerStyle={{
                                        borderBottomWidth: 0,
                                        backgroundColor: 'transparent'
                                    }}
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
                                            value={
                                                resetExpressGraphSyncOnStartup
                                            }
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
                        </>
                    )}
                    <>
                        <View style={{ margin: 10 }}>
                            <Button
                                title={
                                    resetMissionControlSuccess
                                        ? localeString('general.success')
                                        : localeString(
                                              'views.Settings.EmbeddedNode.resetMissionControl'
                                          )
                                }
                                onPress={async () => {
                                    try {
                                        await resetMissionControl();
                                        this.setState({
                                            resetMissionControlSuccess: true
                                        });

                                        setTimeout(() => {
                                            this.setState({
                                                resetMissionControlSuccess:
                                                    false
                                            });
                                        }, 5000);
                                    } catch (e) {
                                        console.log(
                                            'Error on resetMissionControl:',
                                            e
                                        );
                                    }
                                }}
                            />
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
                                    'views.Settings.EmbeddedNode.resetMissionControl.subtitle'
                                )}
                            </Text>
                        </View>
                    </>
                </View>
            </Screen>
        );
    }
}
