import * as React from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import { Row } from '../../../../components/layout/Row';
import Button from '../../../../components/Button';
import Text from '../../../../components/Text';
import TextInput from '../../../../components/TextInput';
import Screen from '../../../../components/Screen';
import Header from '../../../../components/Header';

import SettingsStore from '../../../../stores/SettingsStore';

import { localeString } from '../../../../utils/LocaleUtils';
import { themeColor } from '../../../../utils/ThemeUtils';

interface ZeroConfPeersProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface ZeroConfPeersState {
    zeroConfPeers: Array<string>;
    addPeer: string;
}

@inject('SettingsStore')
@observer
export default class ZeroConfPeers extends React.Component<
    ZeroConfPeersProps,
    ZeroConfPeersState
> {
    state = {
        zeroConfPeers: [],
        addPeer: ''
    };

    remove = (arrOriginal, elementToRemove) => {
        return arrOriginal.filter(function (el) {
            return el !== elementToRemove;
        });
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        this.setState({
            zeroConfPeers: settings.zeroConfPeers || []
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { zeroConfPeers, addPeer } = this.state;
        const { updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.EmbeddedNode.ZeroConfPeers.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView style={{ margin: 5 }}>
                        <View style={{ margin: 5 }}>
                            <Text>
                                {localeString(
                                    'views.Settings.EmbeddedNode.Peers.addPeer'
                                )}
                            </Text>
                            <Row align="flex-end">
                                <TextInput
                                    placeholder="031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581"
                                    onChangeText={(text: string) =>
                                        this.setState({ addPeer: text })
                                    }
                                    value={addPeer}
                                    style={{ flex: 1 }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <View style={{ width: 50, height: 60 }}>
                                    <Button
                                        icon={{
                                            name: 'plus',
                                            type: 'font-awesome',
                                            size: 25
                                        }}
                                        iconOnly
                                        onPress={() => {
                                            if (!addPeer) return;
                                            const newZeroConfPeers = [
                                                ...zeroConfPeers,
                                                addPeer
                                            ];
                                            this.setState({
                                                zeroConfPeers: newZeroConfPeers,
                                                addPeer: ''
                                            });
                                            updateSettings({
                                                zeroConfPeers: newZeroConfPeers
                                            });
                                        }}
                                    />
                                </View>
                            </Row>
                            <Text>
                                {localeString(
                                    'views.Settings.EmbeddedNode.Peers.peersList'
                                )}
                            </Text>
                            {zeroConfPeers && zeroConfPeers.length > 0 ? (
                                <FlatList
                                    data={zeroConfPeers}
                                    renderItem={({ item }: any) => (
                                        <Row align="flex-end">
                                            <TextInput
                                                value={item}
                                                style={{ flex: 1 }}
                                                autoCapitalize="none"
                                                locked
                                            />
                                            <View
                                                style={{
                                                    alignSelf: 'flex-end',
                                                    width: 50,
                                                    height: 60
                                                }}
                                            >
                                                <Button
                                                    icon={{
                                                        name: 'minus',
                                                        type: 'font-awesome',
                                                        size: 25
                                                    }}
                                                    iconOnly
                                                    onPress={() => {
                                                        const newZeroConfPeers =
                                                            this.remove(
                                                                zeroConfPeers,
                                                                item
                                                            );
                                                        this.setState({
                                                            zeroConfPeers:
                                                                newZeroConfPeers
                                                        });
                                                        updateSettings({
                                                            zeroConfPeers:
                                                                newZeroConfPeers
                                                        });
                                                    }}
                                                />
                                            </View>
                                        </Row>
                                    )}
                                    keyExtractor={(item: any, index: number) =>
                                        `${item.txid}-${index}`
                                    }
                                    onEndReachedThreshold={50}
                                />
                            ) : (
                                <Text
                                    style={{
                                        color: themeColor('secondaryText'),
                                        marginTop: 15
                                    }}
                                >{`${localeString(
                                    'general.noneSelected'
                                )}.`}</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
