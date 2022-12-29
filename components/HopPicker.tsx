import * as React from 'react';
import {
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    View,
    Text,
    TouchableOpacity
} from 'react-native';
import { ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import { themeColor } from './../utils/ThemeUtils';
import { localeString } from './../utils/LocaleUtils';

import BalanceSlider from './../components/BalanceSlider';
import Button from './../components/Button';

import Channel from './../models/Channel';

import stores from './../stores/Stores';
import ChannelsStore from './../stores/ChannelsStore';
import UnitsStore from './../stores/UnitsStore';

import PrivacyUtils from './../utils/PrivacyUtils';

interface ChannelPickerProps {
    title?: string;
    displayValue?: string;
    onValueChange: (value: any) => void;
    ChannelsStore: ChannelsStore;
    UnitsStore: UnitsStore;
}

interface ChannelPickerState {
    channelSelected: Channel | null;
    valueSet: string;
    showChannelModal: boolean;
}

const DEFAULT_TITLE = localeString('components.HopPicker.defaultTitle');

@inject('ChannelsStore', 'UnitsStore')
@observer
export default class ChannelPicker extends React.Component<
    ChannelPickerProps,
    ChannelPickerState
> {
    state = {
        channelSelected: null,
        valueSet: '',
        showChannelModal: false
    };

    openPicker() {
        stores.channelsStore.getChannels();
        this.setState({
            channelSelected: null,
            showChannelModal: true
        });
    }

    clearSelection() {
        this.setState({
            channelSelected: null,
            valueSet: ''
        });
    }

    toggleItem(item: any) {
        this.setState({ channelSelected: item });
    }

    render() {
        const { title, onValueChange, ChannelsStore, UnitsStore } = this.props;
        const { channelSelected, showChannelModal, valueSet } = this.state;
        const SettingsStore = stores.settingsStore;
        const { channels, nodes, loading, getChannels } = ChannelsStore;
        const { getAmount, units } = UnitsStore;
        const { settings } = SettingsStore;
        const { privacy } = settings;
        const lurkerMode = (privacy && privacy.lurkerMode) || false;

        return (
            <React.Fragment>
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={showChannelModal}
                >
                    <View style={styles.centeredView}>
                        <View
                            style={{
                                ...styles.modal,
                                backgroundColor: themeColor('background')
                            }}
                        >
                            {showChannelModal && (
                                <>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('text'),
                                            fontSize: 25
                                        }}
                                    >
                                        {localeString(
                                            'components.ChannelPicker.modal.title'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('text'),
                                            paddingTop: 20,
                                            paddingBottom: 20
                                        }}
                                    >
                                        {localeString(
                                            'components.ChannelPicker.modal.description'
                                        )}
                                    </Text>

                                    <FlatList
                                        data={channels}
                                        renderItem={({ item }: any) => {
                                            const displayName =
                                                item.alias ||
                                                (nodes[item.remote_pubkey] &&
                                                    nodes[item.remote_pubkey]
                                                        .alias) ||
                                                item.remote_pubkey ||
                                                item.channelId;

                                            const channelTitle =
                                                PrivacyUtils.sensitiveValue(
                                                    displayName,
                                                    8
                                                );

                                            const localBalanceDisplay =
                                                PrivacyUtils.sensitiveValue(
                                                    getAmount(
                                                        item.localBalance || 0
                                                    ),
                                                    7,
                                                    true
                                                );
                                            const remoteBalanceDisplay =
                                                PrivacyUtils.sensitiveValue(
                                                    getAmount(
                                                        item.remoteBalance || 0
                                                    ),
                                                    7,
                                                    true
                                                );

                                            return (
                                                <>
                                                    <ListItem
                                                        containerStyle={{
                                                            borderBottomWidth: 0,
                                                            backgroundColor:
                                                                themeColor(
                                                                    'background'
                                                                )
                                                        }}
                                                        onPress={() =>
                                                            this.toggleItem(
                                                                item
                                                            )
                                                        }
                                                    >
                                                        <ListItem.Content>
                                                            <ListItem.Title
                                                                style={{
                                                                    color:
                                                                        channelSelected ===
                                                                        item
                                                                            ? 'orange'
                                                                            : themeColor(
                                                                                  'text'
                                                                              )
                                                                }}
                                                            >
                                                                {channelTitle}
                                                            </ListItem.Title>
                                                            <ListItem.Subtitle
                                                                style={{
                                                                    color:
                                                                        channelSelected ===
                                                                        item
                                                                            ? 'orange'
                                                                            : themeColor(
                                                                                  'secondaryText'
                                                                              )
                                                                }}
                                                            >
                                                                {`${
                                                                    !item.isActive
                                                                        ? `${localeString(
                                                                              'views.Wallet.Channels.inactive'
                                                                          )} | `
                                                                        : ''
                                                                }${
                                                                    item.private
                                                                        ? `${localeString(
                                                                              'views.Wallet.Channels.private'
                                                                          )} | `
                                                                        : ''
                                                                }${localeString(
                                                                    'views.Wallet.Channels.local'
                                                                )}: ${
                                                                    units &&
                                                                    localBalanceDisplay
                                                                } | ${localeString(
                                                                    'views.Wallet.Channels.remote'
                                                                )}: ${
                                                                    units &&
                                                                    remoteBalanceDisplay
                                                                }`}
                                                            </ListItem.Subtitle>
                                                        </ListItem.Content>
                                                    </ListItem>
                                                    <BalanceSlider
                                                        localBalance={
                                                            lurkerMode
                                                                ? 50
                                                                : item.localBalance
                                                        }
                                                        remoteBalance={
                                                            lurkerMode
                                                                ? 50
                                                                : item.remoteBalance
                                                        }
                                                    />
                                                </>
                                            );
                                        }}
                                        keyExtractor={(item: any) =>
                                            item.channelId
                                        }
                                        onEndReachedThreshold={50}
                                        refreshing={loading}
                                        onRefresh={() => getChannels()}
                                    />

                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'components.ChannelPicker.modal.set'
                                            )}
                                            onPress={() => {
                                                const { channelSelected }: any =
                                                    this.state;

                                                if (channelSelected) {
                                                    const displayName =
                                                        channelSelected.alias ||
                                                        (nodes[
                                                            channelSelected
                                                                .remote_pubkey
                                                        ] &&
                                                            nodes[
                                                                channelSelected
                                                                    .remote_pubkey
                                                            ].alias) ||
                                                        (channelSelected &&
                                                            channelSelected.remote_pubkey) ||
                                                        (channelSelected &&
                                                            channelSelected.channelId);

                                                    this.setState({
                                                        showChannelModal: false,
                                                        valueSet: displayName
                                                    });

                                                    onValueChange(
                                                        channelSelected
                                                    );
                                                } else {
                                                    this.setState({
                                                        showChannelModal: false
                                                    });
                                                }
                                            }}
                                        />
                                    </View>

                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'general.cancel'
                                            )}
                                            onPress={() =>
                                                this.setState({
                                                    showChannelModal: false
                                                })
                                            }
                                            secondary
                                        />
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>

                <View style={styles.field}>
                    <Text
                        style={{
                            ...styles.text,
                            color: themeColor('text'),
                            paddingLeft: 10
                        }}
                    >
                        {title || DEFAULT_TITLE}
                    </Text>
                    {valueSet ? (
                        <TouchableOpacity onPress={() => this.clearSelection()}>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text'),
                                    padding: 10,
                                    fontSize: 16
                                }}
                            >
                                {valueSet}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={() => this.openPicker()}>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text'),
                                    padding: 10,
                                    fontSize: 16
                                }}
                            >
                                {localeString(
                                    'components.HopPicker.selectChannel'
                                )}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
    },
    field: {
        paddingTop: 10,
        marginLeft: Platform.OS === 'ios' ? 0 : -8
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    },
    modal: {
        margin: 20,
        borderRadius: 20,
        padding: 35,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22
    }
});
