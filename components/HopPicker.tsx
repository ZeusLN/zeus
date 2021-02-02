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
    Picker,
    TouchableOpacity
} from 'react-native';
import { Avatar, ListItem } from 'react-native-elements';
import { remove } from 'lodash';
import { inject, observer } from 'mobx-react';
import { localeString } from './../utils/LocaleUtils';
import Identicon from 'identicon.js';
const hash = require('object-hash');

import stores from './../stores/Stores';
import ChannelsStore from './../stores/ChannelsStore';
import Channel from './../model/Channel';
import UnitsStore from './../stores/UnitsStore';

import BalanceSlider from './../components/BalanceSlider';
import PrivacyUtils from './../utils/PrivacyUtils';

const SelectedLight = require('./../images/selected-light.png');
const SelectedDark = require('./../images/selected-dark.png');
const UnselectedLight = require('./../images/unselected-light.png');
const UnselectedDark = require('./../images/unselected-dark.png');

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
    channelSelected: Channel;
    valueSet: string;
    showChannelModal: boolean;
    setBalance: number;
}

const ChannelIcon = (balanceImage: string) => (
    <Avatar
        source={{
            uri: balanceImage
        }}
    />
);

const VALUES = [
    { key: 'Select Channel to use', value: 'Select Channel to use' },
    { key: 'Clear selection', value: 'Clear selection' }
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
        channelSelected: {},
        valueSet: '',
        showChannelModal: false
    };

    openPicker() {
        stores.channelsStore.getChannels();
        this.setState({
            channelSelected: {},
            showChannelModal: true
        });
    }

    clearSelection() {
        this.setState({
            channelSelected: {},
            valueSet: ''
        });
    }

    displayValues(): string {
        const { channelSelected } = this.state;
        return channelSelected.channelId;
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
        const {
            channelSelected,
            channelSet,
            showChannelModal,
            valueSet
        } = this.state;
        const SettingsStore = stores.settingsStore;
        const { channels, nodes, loading, getChannels } = ChannelsStore;
        const { getAmount, units } = UnitsStore;
        const { settings } = SettingsStore;
        const { theme, lurkerMode } = settings;

        let channelPicked = channelSelected;
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
                            style={
                                theme === 'dark'
                                    ? styles.modalDark
                                    : styles.modal
                            }
                        >
                            {showChannelModal && (
                                <>
                                    <Text
                                        style={{
                                            fontSize: 25,
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
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
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
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

                                            const channelTitle = lurkerMode
                                                ? PrivacyUtils.hideValue(
                                                      displayName,
                                                      8
                                                  )
                                                : displayName;

                                            const data = new Identicon(
                                                hash.sha1(channelTitle),
                                                255
                                            ).toString();

                                            const localBalanceDisplay = lurkerMode
                                                ? PrivacyUtils.hideValue(
                                                      getAmount(
                                                          item.localBalance || 0
                                                      ),
                                                      7,
                                                      true
                                                  )
                                                : getAmount(
                                                      item.localBalance || 0
                                                  );
                                            const remoteBalanceDisplay = lurkerMode
                                                ? PrivacyUtils.hideValue(
                                                      getAmount(
                                                          item.remoteBalance ||
                                                              0
                                                      ),
                                                      7,
                                                      true
                                                  )
                                                : getAmount(
                                                      item.remoteBalance || 0
                                                  );

                                            return (
                                                <>
                                                    <ListItem
                                                        title={channelTitle}
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
                                                            backgroundColor:
                                                                theme === 'dark'
                                                                    ? 'black'
                                                                    : 'white'
                                                        }}
                                                        leftElement={
                                                            channelPicked ===
                                                            item.channelId
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
                                                                theme === 'dark'
                                                                    ? 'white'
                                                                    : 'black'
                                                        }}
                                                        subtitleStyle={{
                                                            color:
                                                                theme === 'dark'
                                                                    ? 'gray'
                                                                    : '#8a8999'
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
                                                        theme={theme}
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
                                                } = this.state;

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
                                                    channelSelected.remote_pubkey ||
                                                    channelSelected.channelId;

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
                                color: theme === 'dark' ? 'white' : 'black',
                                paddingLeft: 10
                            }}
                        >
                            {title || DEFAULT_TITLE}
                        </Text>
                        <Picker
                            selectedValue={selectedValue}
                            onValueChange={(itemValue: string) => {
                                if (itemValue === 'Clear selection') {
                                    this.clearSelection();
                                } else if (
                                    itemValue === 'Select Channels to use'
                                ) {
                                    this.openPicker();
                                }
                            }}
                            style={
                                theme === 'dark'
                                    ? styles.pickerDark
                                    : styles.picker
                            }
                        >
                            {pickerValuesAndroid}
                        </Picker>
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View style={styles.field}>
                        <Text
                            style={{
                                color: theme === 'dark' ? 'white' : 'black',
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
                                        if (buttonIndex == 2) {
                                            this.clearSelection();
                                        } else if (buttonIndex == 1) {
                                            this.openPicker();
                                        }
                                    }
                                )
                            }
                        >
                            <Text
                                style={{
                                    color: theme === 'dark' ? 'white' : 'black'
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
        paddingTop: 10
    },
    picker: {
        height: 50,
        color: 'black'
    },
    pickerDark: {
        height: 50,
        color: 'white'
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    },
    modal: {
        margin: 20,
        backgroundColor: 'white',
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
    modalDark: {
        margin: 20,
        color: 'white',
        backgroundColor: 'black',
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
