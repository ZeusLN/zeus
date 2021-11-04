import * as React from 'react';
import {
    ActionSheetIOS,
    Button,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    View,
    Text,
    TouchableOpacity
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Avatar, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import Identicon from 'identicon.js';
const hash = require('object-hash');

import stores from './../stores/Stores';
import ChannelsStore from './../stores/ChannelsStore';
import Channel from './../models/Channel';
import UnitsStore from './../stores/UnitsStore';

import BalanceSlider from './../components/BalanceSlider';
import PrivacyUtils from './../utils/PrivacyUtils';

const SelectedLight = require('./../images/selected-light.png');
const SelectedDark = require('./../images/selected-dark.png');

interface ChannelPickerProps {
    title?: string;
    selectedValue?: string | boolean;
    displayValue?: string;
    onValueChange: (value: any) => void;
    ChannelsStore: ChannelsStore;
    UnitsStore: UnitsStore;
}

interface ChannelPickerState {
    status: string;
    channelSelected: Channel | null;
    valueSet: string;
    showChannelModal: boolean;
}

const ChannelIcon = (balanceImage: string) => (
    <Avatar
        source={{
            uri: balanceImage
        }}
    />
);

const VALUES = [
    { key: 'No selection', value: 'No selection' },
    { key: 'Select Channel to use', value: 'Select Channel to use' }
];

const DEFAULT_TITLE = 'Channels to use';

const Icon = (balanceImage: any) => <Avatar source={balanceImage} />;

@inject('ChannelsStore', 'UnitsStore')
@observer
export default class ChannelPicker extends React.Component<
    ChannelPickerProps,
    ChannelPickerState
> {
    state = {
        status: 'unselected',
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
        const {
            title,
            selectedValue,
            onValueChange,
            ChannelsStore,
            UnitsStore
        } = this.props;
        const { channelSelected, showChannelModal, valueSet } = this.state;
        const SettingsStore = stores.settingsStore;
        const { channels, nodes, loading, getChannels } = ChannelsStore;
        const { getAmount, units } = UnitsStore;
        const { settings } = SettingsStore;
        const { theme, privacy } = settings;
        const { lurkerMode } = privacy;

        const pickerValuesAndroid: Array<any> = [];
        const pickerValuesIOS: Array<string> = ['Cancel'];
        VALUES.forEach((value: { key: string; value: string }) => {
            pickerValuesAndroid.push(
                <Picker.Item
                    key={value.key}
                    label={value.key}
                    value={value.value}
                />
            );
            pickerValuesIOS.push(value.key);
        });

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
                                            fontSize: 25,
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'components.ChannelPicker.modal.title'
                                        )}
                                    </Text>
                                    <Text
                                        style={{
                                            paddingTop: 20,
                                            paddingBottom: 20,
                                            color: themeColor('text')
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

                                            const channelTitle = PrivacyUtils.sensitiveValue(
                                                displayName,
                                                8
                                            );

                                            const data = new Identicon(
                                                hash.sha1(channelTitle),
                                                255
                                            ).toString();

                                            const localBalanceDisplay = PrivacyUtils.sensitiveValue(
                                                getAmount(
                                                    item.localBalance || 0
                                                ),
                                                7,
                                                true
                                            );
                                            const remoteBalanceDisplay = PrivacyUtils.sensitiveValue(
                                                getAmount(
                                                    item.remoteBalance || 0
                                                ),
                                                7,
                                                true
                                            );

                                            return (
                                                <>
                                                    <ListItem
                                                        title={`${channelTitle}`}
                                                        subtitle={`${
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
                                                        )}: ${units &&
                                                            localBalanceDisplay} | ${localeString(
                                                            'views.Wallet.Channels.remote'
                                                        )}: ${units &&
                                                            remoteBalanceDisplay}`}
                                                        containerStyle={{
                                                            borderBottomWidth: 0,
                                                            backgroundColor: themeColor(
                                                                'background'
                                                            )
                                                        }}
                                                        leftElement={
                                                            channelSelected ===
                                                            item
                                                                ? theme ===
                                                                  'dark'
                                                                    ? Icon(
                                                                          SelectedDark
                                                                      )
                                                                    : Icon(
                                                                          SelectedLight
                                                                      )
                                                                : ChannelIcon(
                                                                      `data:image/png;base64,${data}`
                                                                  )
                                                        }
                                                        onPress={() =>
                                                            this.toggleItem(
                                                                item
                                                            )
                                                        }
                                                        titleStyle={{
                                                            color:
                                                                channelSelected ===
                                                                item
                                                                    ? 'orange'
                                                                    : themeColor(
                                                                          'text'
                                                                      )
                                                        }}
                                                        subtitleStyle={{
                                                            color:
                                                                channelSelected ===
                                                                item
                                                                    ? 'orange'
                                                                    : themeColor(
                                                                          'secondaryText'
                                                                      )
                                                        }}
                                                    />
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
                                                        list
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
                                                const {
                                                    channelSelected
                                                }: any = this.state;

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
                                        />
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>

                {Platform.OS !== 'ios' && (
                    <View style={styles.field}>
                        <Text
                            style={{
                                color: themeColor('text'),
                                paddingLeft: 10
                            }}
                        >
                            {title || DEFAULT_TITLE}
                        </Text>
                        {valueSet ? (
                            <TouchableOpacity
                                onPress={() => this.clearSelection()}
                            >
                                <Text
                                    style={{
                                        padding: 10,
                                        fontSize: 16,
                                        color: themeColor('text')
                                    }}
                                >
                                    {valueSet}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <Picker
                                selectedValue={`${selectedValue}`}
                                onValueChange={(itemValue: string) => {
                                    if (itemValue === 'No selection') {
                                        this.clearSelection();
                                    } else if (
                                        itemValue === 'Select Channel to use'
                                    ) {
                                        this.openPicker();
                                    }
                                }}
                                style={{
                                    height: 50,
                                    color: themeColor('text')
                                }}
                            >
                                {pickerValuesAndroid}
                            </Picker>
                        )}
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View style={styles.field}>
                        <Text
                            style={{
                                color: themeColor('text'),
                                textDecorationLine: 'underline'
                            }}
                        >
                            {title || DEFAULT_TITLE}
                        </Text>
                        <TouchableOpacity
                            onPress={() =>
                                ActionSheetIOS.showActionSheetWithOptions(
                                    {
                                        options: pickerValuesIOS,
                                        cancelButtonIndex: 0
                                    },
                                    buttonIndex => {
                                        if (buttonIndex == 1) {
                                            this.clearSelection();
                                        } else if (buttonIndex == 2) {
                                            this.openPicker();
                                        }
                                    }
                                )
                            }
                        >
                            <Text
                                style={{
                                    color: themeColor('text')
                                }}
                            >
                                {valueSet ? valueSet : 'No selection'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
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
