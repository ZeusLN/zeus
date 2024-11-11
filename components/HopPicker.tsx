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
    ViewStyle
} from 'react-native';
import { inject, observer } from 'mobx-react';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import backendUtils from '../utils/BackendUtils';

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
        stores.channelsStore.getChannels().then(() => {
            this.setState({
                selectedChannels: this.state.selectedChannels
                    .map((c1) =>
                        stores.channelsStore.channels.find(
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
                        inbound={item.remoteBalance}
                        outbound={item.localBalance}
                        inboundReserve={item.remoteReserveBalance}
                        outboundReserve={item.localReserveBalance}
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
                    inboundReserve={item.remoteReserveBalance}
                    outboundReserve={item.localReserveBalance}
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
                                {selectionMode === 'multiple'
                                    ? localeString(
                                          'components.ChannelPicker.modal.title.multiple'
                                      )
                                    : localeString(
                                          'components.ChannelPicker.modal.title'
                                      )}
                            </Text>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text'),
                                    paddingTop: 20,
                                    paddingBottom: 10
                                }}
                            >
                                {selectionMode === 'multiple'
                                    ? localeString(
                                          'components.ChannelPicker.modal.description.multiple'
                                      )
                                    : localeString(
                                          'components.ChannelPicker.modal.description'
                                      )}
                            </Text>

                            <ChannelsFilter />

                            <FlatList
                                data={channels}
                                renderItem={(item) => this.renderItem(item)}
                                onEndReachedThreshold={50}
                                refreshing={loading}
                                onRefresh={() => this.refreshChannels()}
                            />

                            {selectionMode === 'multiple' &&
                                backendUtils.isLNDBased() &&
                                selectedChannels.length >
                                    MAX_NUMBER_ROUTE_HINTS_LND && (
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('warning'),
                                            alignSelf: 'flex-end',
                                            marginTop: 5,
                                            marginEnd: 16
                                        }}
                                    >
                                        {MAX_NUMBER_ROUTE_HINTS_LND}{' '}
                                        {localeString(
                                            'components.HopPicker.routeHintsMax'
                                        )}
                                    </Text>
                                )}

                            <View style={styles.button}>
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
                                />
                            </View>

                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() => {
                                        this.setState({
                                            showChannelModal: false
                                        });
                                        onCancel?.();
                                    }}
                                    secondary
                                />
                            </View>
                        </View>
                    </View>
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
