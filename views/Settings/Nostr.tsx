import * as React from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import { Row } from '../../components/layout/Row';
import Button from '../../components/Button';
import KeyValue from '../../components/KeyValue';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import Screen from '../../components/Screen';
import Header from '../../components/Header';

import SettingsStore from '../../stores/SettingsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface NostrProps {
    navigation: any;
    SettingsStore: SettingsStore;
}

interface NostrState {
    relays: Array<string>;
    addRelay: string;
    nsec: string;
}

@inject('SettingsStore')
@observer
export default class Nostr extends React.Component<NostrProps, NostrState> {
    state = {
        nsec: '',
        relays: [],
        addRelay: ''
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
            relays: settings.nostr.relays || [],
            nsec: settings.nostr.nsec || ''
        });
    }

    render() {
        const { navigation, SettingsStore } = this.props;
        const { relays, nsec, addRelay } = this.state;
        const { updateSettings }: any = SettingsStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: 'Nostr',
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
                                    'views.Settings.EmbeddedNode.Peers.addRelay'
                                )}
                            </Text>
                            <KeyValue
                                keyValue={localeString(
                                    'views.Settings.Nostr.addRelay'
                                )}
                            />
                            <Row align="flex-end">
                                <TextInput
                                    placeholder="wss://relay.damus.io"
                                    onChangeText={(text: string) =>
                                        this.setState({ addRelay: text })
                                    }
                                    value={addRelay}
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
                                            if (!addRelay) return;
                                            const newRelays = [
                                                ...relays,
                                                addRelay
                                            ];
                                            this.setState({
                                                relays: newRelays,
                                                addRelay: ''
                                            });
                                            updateSettings({
                                                relays: newRelays
                                            });
                                        }}
                                    />
                                </View>
                            </Row>
                            <Text>
                                {localeString('views.Settings.Nostr.relays')}
                            </Text>
                            {relays && relays.length > 0 ? (
                                <FlatList
                                    data={relays}
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
                                                        const newNostr =
                                                            this.remove(
                                                                relays,
                                                                item
                                                            );
                                                        this.setState({
                                                            relays: newNostr
                                                        });
                                                        updateSettings({
                                                            nostr: {
                                                                relays: newNostr,
                                                                nsec
                                                            }
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
