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
import remove from 'lodash/remove';
import { inject, observer } from 'mobx-react';
import { localeString } from './../utils/LocaleUtils';

import stores from './../stores/Stores';
import UTXOsStore from './../stores/UTXOsStore';

const SelectedLight = require('./../images/selected-light.png');
const SelectedDark = require('./../images/selected-dark.png');
const UnselectedLight = require('./../images/unselected-light.png');
const UnselectedDark = require('./../images/unselected-dark.png');

interface UTXOPickerProps {
    title?: string;
    selectedValue?: string | boolean;
    displayValue?: string;
    onValueChange: (value: any, balance: number) => void;
    UTXOsStore: UTXOsStore;
}

interface UTXOPickerState {
    status: string;
    utxosSelected: string[];
    utxosSet: string[];
    showUtxoModal: boolean;
    selectedBalance: number;
    setBalance: number;
}

const VALUES = [
    { key: 'No selection', value: 'No selection' },
    { key: 'Select UTXOs to use', value: 'Select UTXOs to use' }
];

const DEFAULT_TITLE = 'UTXOs to use';

const Icon = (balanceImage: any) => <Avatar source={balanceImage} />;

@inject('UTXOsStore')
@observer
export default class UTXOPicker extends React.Component<
    UTXOPickerProps,
    UTXOPickerState
> {
    state = {
        status: 'unselected',
        utxosSelected: [],
        utxosSet: [],
        showUtxoModal: false,
        selectedBalance: 0,
        setBalance: 0
    };

    openPicker() {
        stores.utxosStore.getUTXOs();
        this.setState({
            utxosSelected: [],
            showUtxoModal: true,
            selectedBalance: 0
        });
    }

    clearSelection() {
        this.setState({
            utxosSelected: [],
            utxosSet: [],
            selectedBalance: 0,
            setBalance: 0
        });
    }

    displayValues(): string {
        const display: string[] = [];
        this.state.utxosSelected.forEach((utxo: any) => {
            const length: number = utxo.length;
            const pre: string = utxo.slice(0, 4);
            const post: string = utxo.slice(length - 4, length);
            display.push(`${pre}...${post}`);
        });
        return display.join(', ');
    }

    toggleItem(item: any) {
        const { utxosSelected, selectedBalance } = this.state;
        let newArray: string[] = [];
        utxosSelected.forEach((utxo: string) => newArray.push(utxo));
        const { txid, output } = item;
        const itemId: string = `${txid}:${output}`;
        let balance;
        if (!newArray.includes(itemId)) {
            newArray.push(itemId);
            balance = selectedBalance + item.value;
        } else {
            newArray = remove(newArray, function(n) {
                return n !== itemId;
            });
            balance = selectedBalance - item.value;
        }

        this.setState({ utxosSelected: newArray, selectedBalance: balance });
    }

    render() {
        const { title, selectedValue, onValueChange, UTXOsStore } = this.props;
        const {
            utxosSelected,
            utxosSet,
            showUtxoModal,
            selectedBalance
        } = this.state;
        const SettingsStore = stores.settingsStore;
        const { utxos, loading, getUTXOs } = UTXOsStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        let utxosPicked: string[] = [];
        utxosSelected.forEach((utxo: string) => utxosPicked.push(utxo));

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
                    visible={showUtxoModal}
                >
                    <View style={styles.centeredView}>
                        <View
                            style={
                                theme === 'dark'
                                    ? styles.modalDark
                                    : styles.modal
                            }
                        >
                            {showUtxoModal && (
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
                                            'components.UTXOPicker.modal.title'
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
                                            'components.UTXOPicker.modal.description'
                                        )}
                                    </Text>

                                    <Text
                                        style={{
                                            fontSize: 20,
                                            paddingTop: 20,
                                            paddingBottom: 20,
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
                                        }}
                                    >
                                        {`${selectedBalance} ${localeString(
                                            'views.Receive.satoshis'
                                        )}`}
                                    </Text>

                                    <FlatList
                                        data={utxos}
                                        renderItem={({ item }: any) => (
                                            <ListItem
                                                key={item.txid}
                                                title={`${item.txid}:${item.output}`}
                                                subtitle={`${item.value.toString()} ${localeString(
                                                    'views.Send.satoshis'
                                                )}`}
                                                containerStyle={{
                                                    borderBottomWidth: 0,
                                                    backgroundColor:
                                                        theme === 'dark'
                                                            ? 'black'
                                                            : 'white'
                                                }}
                                                leftElement={
                                                    utxosPicked.includes(
                                                        `${item.txid}:${item.output}`
                                                    )
                                                        ? theme === 'dark'
                                                            ? Icon(SelectedDark)
                                                            : Icon(
                                                                  SelectedLight
                                                              )
                                                        : theme === 'dark'
                                                        ? Icon(UnselectedDark)
                                                        : Icon(UnselectedLight)
                                                }
                                                onPress={() =>
                                                    this.toggleItem(item)
                                                }
                                                titleStyle={{
                                                    color: utxosPicked.includes(
                                                        `${item.txid}:${item.output}`
                                                    )
                                                        ? 'orange'
                                                        : theme === 'dark'
                                                        ? 'white'
                                                        : 'black'
                                                }}
                                                subtitleStyle={{
                                                    color: utxosPicked.includes(
                                                        `${item.txid}:${item.output}`
                                                    )
                                                        ? 'orange'
                                                        : theme === 'dark'
                                                        ? 'gray'
                                                        : '#8a8999'
                                                }}
                                            />
                                        )}
                                        keyExtractor={(item: any) => item.txid}
                                        onEndReachedThreshold={50}
                                        refreshing={loading}
                                        onRefresh={() => getUTXOs()}
                                    />

                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'components.UTXOPicker.modal.set'
                                            )}
                                            onPress={() => {
                                                const {
                                                    utxosSelected,
                                                    selectedBalance
                                                } = this.state;
                                                this.setState({
                                                    showUtxoModal: false,
                                                    utxosSet: utxosSelected,
                                                    setBalance: selectedBalance
                                                });

                                                onValueChange(
                                                    utxosSelected,
                                                    selectedBalance
                                                );
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
                                                    showUtxoModal: false
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
                    <View>
                        <Text
                            style={{
                                color: theme === 'dark' ? 'white' : 'black',
                                paddingLeft: 10
                            }}
                        >
                            {title || DEFAULT_TITLE}
                        </Text>
                        {utxosSet.length > 0 ? (
                            <Text
                                style={{
                                    padding: 10,
                                    fontSize: 16,
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                {this.displayValues()}
                            </Text>
                        ) : (
                            <Picker
                                selectedValue={selectedValue}
                                onValueChange={(itemValue: string) => {
                                    if (itemValue === 'No selection') {
                                        this.clearSelection();
                                    } else if (
                                        itemValue === 'Select UTXOs to use'
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
                        )}
                    </View>
                )}

                {Platform.OS === 'ios' && (
                    <View>
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
                                    color: theme === 'dark' ? 'white' : 'black'
                                }}
                            >
                                {utxosSet.length > 0
                                    ? this.displayValues()
                                    : 'No UTXOs selected'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
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
