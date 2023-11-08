import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Button from '../../../components/Button';
import Screen from '../../../components/Screen';
import Header from '../../../components/Header';

import SettingsStore from '../../../stores/SettingsStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import Switch from '../../../components/Switch';

import { resetMissionControl } from '../../../lndmobile';

interface PathfindingProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface PathfindingState {
    bimodalPathfinding: boolean | undefined;
    resetMissionControlSuccess: boolean | undefined;
}

@inject('SettingsStore')
@observer
export default class Pathfinding extends React.Component<
    PathfindingProps,
    PathfindingState
> {
    state = {
        bimodalPathfinding: false,
        resetMissionControlSuccess: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            bimodalPathfinding: settings.bimodalPathfinding
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { bimodalPathfinding, resetMissionControlSuccess } = this.state;
        const { updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.Pathfinding.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
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
                            >
                                <ListItem.Title
                                    style={{
                                        color: themeColor('secondaryText'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.EmbeddedNode.bimodalPathfinding'
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
                                        value={bimodalPathfinding}
                                        onValueChange={async () => {
                                            this.setState({
                                                bimodalPathfinding:
                                                    !bimodalPathfinding
                                            });
                                            await updateSettings({
                                                bimodalPathfinding:
                                                    !bimodalPathfinding
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
                                        'views.Settings.EmbeddedNode.bimodalPathfinding.subtitle'
                                    )}
                                </Text>
                            </View>
                        </>
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
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
