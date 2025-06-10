import * as React from 'react';
import {
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    TouchableHighlight,
    ViewStyle,
    SafeAreaView
} from 'react-native';
import { inject, observer } from 'mobx-react';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import backendUtils from '../utils/BackendUtils';

import Button from '../components/Button';
import { ChannelItem } from './Channels/ChannelItem';
import ChannelsFilter from './Channels/ChannelsFilter';

import Channel from '../models/Channel';

import ChannelsStore, { ChannelsType } from '../stores/ChannelsStore';
import UnitsStore from '../stores/UnitsStore';

interface ChannelPickerProps {
    title?: string;
    displayValue?: string;
    onValueChange: (channels: Channel[]) => void;
    onCancel?: () => void;
    ChannelsStore: ChannelsStore;
    UnitsStore: UnitsStore;
    containerStyle?: ViewStyle;
    clearOnTap?: boolean;
    selectionMode?: 'single' | 'multiple';
    selectedChannels?: Channel[];
}

interface ChannelPickerState {
    selectedChannels: Channel[];
    valueSet: string;
    showChannelModal: boolean;
}

const DEFAULT_TITLE = localeString('components.HopPicker.defaultTitle');
const MAX_NUMBER_ROUTE_HINTS_LND = 20;

@inject('ChannelsStore', 'UnitsStore')
@observer
export default class ChannelPicker extends React.Component<
    ChannelPickerProps,
    ChannelPickerState
> {
    state: ChannelPickerState = {
        selectedChannels: [],
        valueSet: '',
        showChannelModal: false
    };

    componentDidMount(): void {
        if (this.props.selectedChannels != null) {
            this.setState(
                { selectedChannels: this.props.selectedChannels },
                this.updateValueSet
            );
        }
    }

    refreshChannels(): void {
        const { ChannelsStore } = this.props;
        ChannelsStore.getChannels().then(() => {
            this.setState({
                selectedChannels: this.state.selectedChannels
                    .map((c1) =>
                        ChannelsStore.channels.find(
                            (c2) => c2.channelId === c1.channelId
                        )
                    )
                    .filter((chan) => chan != null) as Channel[]
            });
        });
    }

    updateValueSet(): void {
        const nodes = this.props.ChannelsStore.nodes;
        const displayNames = this.state.selectedChannels
            .map(
                (chan) =>
                    chan.alias ||
                    (nodes[chan.remote_pubkey] &&
                        nodes[chan.remote_pubkey].alias) ||
                    (chan && chan.remote_pubkey) ||
                    (chan && chan.channelId)
            )
            .join(', ');

        this.setState({
            showChannelModal: false,
            valueSet: displayNames
        });
    }

    openPicker() {
        this.refreshChannels();
        this.setState({
            showChannelModal: true
        });
    }

    clearSelection() {
        const selectedChannels: Channel[] = [];
        this.setState({
            selectedChannels,
            valueSet: ''
        });
        this.props.onValueChange(selectedChannels);
    }

    toggleItem(item: Channel) {
        if (this.props.selectionMode === 'multiple') {
            const selectedChannels = this.state.selectedChannels;
            if (selectedChannels.includes(item)) {
                selectedChannels.splice(selectedChannels.indexOf(item), 1);
            } else {
                selectedChannels.push(item);
            }
            this.setState({ selectedChannels });
        } else {
            this.setState({ selectedChannels: [item] });
        }
    }

    renderItem = ({ item }: { item: Channel }) => {
        const { ChannelsStore } = this.props;
        const { selectedChannels } = this.state;
        const { largestChannelSats, channelsType } = ChannelsStore;

        const selected = selectedChannels.includes(item);

        if (channelsType === ChannelsType.Open) {
            return (
                <TouchableHighlight onPress={() => this.toggleItem(item)}>
                    <ChannelItem
                        title={item.displayName}
                        localBalance={item.localBalance}
                        remoteBalance={item.remoteBalance}
                        sendingCapacity={item.sendingCapacity}
                        receivingCapacity={item.receivingCapacity}
                        outboundReserve={item.localReserveBalance}
                        inboundReserve={item.remoteReserveBalance}
                        isBelowReserve={item.isBelowReserve}
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
                    localBalance={item.localBalance}
                    remoteBalance={item.remoteBalance}
                    sendingCapacity={item.sendingCapacity}
                    receivingCapacity={item.receivingCapacity}
                    outboundReserve={item.localReserveBalance}
                    inboundReserve={item.remoteReserveBalance}
                    isBelowReserve={item.isBelowReserve}
                    selected={selected}
                />
            </TouchableHighlight>
        );
    };

    render() {
        const {
            title,
            onValueChange,
            onCancel,
            ChannelsStore,
            containerStyle,
            selectionMode
        } = this.props;
        const clearOnTap = this.props.clearOnTap ?? true;
        const { showChannelModal, valueSet, selectedChannels } = this.state;
        const { filteredChannels, loading } = ChannelsStore;

        const channels = filteredChannels;

        return (
            <React.Fragment>
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={showChannelModal}
                    onRequestClose={() =>
                        this.setState({ showChannelModal: false })
                    }
                >
                    <SafeAreaView style={styles.centeredView}>
                        <View style={styles.modalBackground}>
                            <View
                                style={[
                                    styles.modal,
                                    {
                                        backgroundColor:
                                            themeColor('modalBackground')
                                    }
                                ]}
                            >
                                <View
                                    style={[
                                        styles.handleBar,
                                        {
                                            backgroundColor:
                                                themeColor('secondaryText')
                                        }
                                    ]}
                                />

                                <Text
                                    style={[
                                        styles.modalTitle,
                                        { color: themeColor('text') }
                                    ]}
                                >
                                    {selectionMode === 'multiple'
                                        ? localeString(
                                              'components.ChannelPicker.modal.title.multiple'
                                          )
                                        : localeString(
                                              'components.ChannelPicker.modal.title'
                                          )}
                                </Text>

                                <View style={styles.filterContainer}>
                                    <ChannelsFilter />
                                </View>

                                <FlatList
                                    data={channels}
                                    renderItem={(item) => this.renderItem(item)}
                                    style={styles.list}
                                    contentContainerStyle={styles.listContent}
                                    onEndReachedThreshold={50}
                                    refreshing={loading}
                                    onRefresh={() => this.refreshChannels()}
                                />

                                <View style={styles.buttonRow}>
                                    <Button
                                        title={localeString('general.cancel')}
                                        onPress={() => {
                                            this.setState({
                                                showChannelModal: false
                                            });
                                            onCancel?.();
                                        }}
                                        containerStyle={styles.flexButton}
                                        secondary
                                    />
                                    <Button
                                        title={localeString('general.confirm')}
                                        disabled={
                                            selectedChannels.length === 0 ||
                                            (selectionMode === 'multiple' &&
                                                backendUtils.isLNDBased() &&
                                                selectedChannels.length >
                                                    MAX_NUMBER_ROUTE_HINTS_LND)
                                        }
                                        onPress={() => {
                                            this.updateValueSet();
                                            this.setState({
                                                showChannelModal: false
                                            });
                                            onValueChange(selectedChannels);
                                        }}
                                        containerStyle={styles.flexButton}
                                    />
                                </View>
                            </View>
                        </View>
                    </SafeAreaView>
                </Modal>

                <View style={{ ...containerStyle, ...styles.field }}>
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
                        <TouchableOpacity
                            onPress={() => {
                                if (clearOnTap) {
                                    this.clearSelection();
                                } else {
                                    this.openPicker();
                                }
                            }}
                        >
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
        paddingTop: 10
    },
    modal: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 8,
        height: '100%'
    },
    centeredView: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalBackground: {
        flex: 1,
        justifyContent: 'flex-end'
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginVertical: 8
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 16,
        paddingTop: 10,
        textAlign: 'center'
    },
    filterContainer: {
        marginBottom: 16,
        width: '100%'
    },
    list: {
        flex: 1,
        marginBottom: 16,
        flexGrow: 1
    },
    listContent: {
        paddingBottom: 16
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16
    },
    flexButton: {
        flex: 1
    }
});
