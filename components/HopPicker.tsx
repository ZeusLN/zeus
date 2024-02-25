import * as React from 'react';
import {
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    TouchableHighlight
} from 'react-native';
import { inject, observer } from 'mobx-react';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

import Button from '../components/Button';
import { ChannelItem } from './Channels/ChannelItem';
import ChannelsFilter from './Channels/ChannelsFilter';

import Channel from '../models/Channel';

import stores from '../stores/Stores';
import ChannelsStore, { ChannelsType } from '../stores/ChannelsStore';
import UnitsStore from '../stores/UnitsStore';

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

    renderItem = ({ item }: { item: Channel }) => {
        const { ChannelsStore } = this.props;
        const { channelSelected } = this.state;
        const { largestChannelSats, channelsType } = ChannelsStore;

        const selected = channelSelected === item;

        if (channelsType === ChannelsType.Open) {
            return (
                <TouchableHighlight onPress={() => this.toggleItem(item)}>
                    <ChannelItem
                        title={item.displayName}
                        inbound={item.remoteBalance}
                        outbound={item.localBalance}
                        largestTotal={largestChannelSats}
                        selected={selected}
                    />
                </TouchableHighlight>
            );
        }

        return (
            <TouchableHighlight onPress={() => this.toggleItem(item)}>
                <ChannelItem
                    title={item.displayName}
                    inbound={item.remoteBalance}
                    outbound={item.localBalance}
                    selected={selected}
                />
            </TouchableHighlight>
        );
    };

    render() {
        const { title, onValueChange, ChannelsStore } = this.props;
        const { showChannelModal, valueSet } = this.state;
        const { filteredChannels, nodes, loading, getChannels } = ChannelsStore;

        const channels = filteredChannels;

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
                                backgroundColor: themeColor('secondary')
                            }}
                        >
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

                            <ChannelsFilter width="86%" />

                            <FlatList
                                data={channels}
                                renderItem={(item) => this.renderItem(item)}
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

                                            onValueChange(channelSelected);
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
                                    title={localeString('general.cancel')}
                                    onPress={() =>
                                        this.setState({
                                            showChannelModal: false
                                        })
                                    }
                                    secondary
                                />
                            </View>
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
        fontFamily: 'PPNeueMontreal-Book'
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
