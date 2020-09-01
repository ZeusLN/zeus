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
import { localeString } from './../utils/LocaleUtils';
import stores from './../stores/Stores';

const SelectedLight = require('./../images/selected-light.png');
const SelectedDark = require('./../images/selected-dark.png');
const UnselectedLight = require('./../images/unselected-light.png');
const UnselectedDark = require('./../images/unselected-dark.png');

interface UTXOPickerProps {
    title: string;
    selectedValue: string | boolean;
    displayValue?: string;
    onValueChange: (value: any) => void;
}

interface UTXOPickerState {
    status: string;
    utxosSelected: Array<any>;
    utxosSet: Array<any>;
    showUtxoModal: boolean;
}

const VALUES = [
    { key: 'Select UTXOs to use', value: 'Select UTXOs to use' },
    { key: 'Clear selection', value: 'Clear selection' }
];

const DEFAULT_TITLE = 'UTXOs to use';

const Icon = (balanceImage: any) => <Avatar source={balanceImage} />;

export default class UTXOPicker extends React.Component<
    UTXOPickerProps,
    UTXOPickerState
> {
    state = {
        status: 'unselected',
        utxosSelected: [],
        utxosSet: [],
        showUtxoModal: false
    };

    openPicker() {
        stores.utxosStore.getUTXOs();
        this.setState({
            utxosSelected: [],
            showUtxoModal: true
        });
    }

    clearSelection() {
        this.setState({
            utxosSelected: [],
            utxosSet: []
        });
    }

    displayValues(): string {
        const display = [];
        this.state.utxosSelected.forEach((utxo: any) => {
            const length: number = utxo.length;
            const pre: string = utxo.slice(0, 4);
            const post: string = utxo.slice(length - 4, length);
            display.push(`${pre}....${post}`);
        });
        return display.join(', ');
    }

    toggleItem(item: any) {
        const { utxosSelected } = this.state;
        let newArray = utxosSelected;
        const id = `${item.txid}:${item.output}`;
        if (!utxosSelected.includes(id)) {
            newArray.push(id);
        } else {
            newArray = remove(newArray, function(n) {
                return n !== id;
            });
        }

        this.setState({ utxosSelected: newArray });
    }

    render() {
        const {
            title,
            selectedValue,
            displayValue,
            onValueChange
        } = this.props;
        const { utxosSelected, utxosSet, showUtxoModal } = this.state;
        const UTXOStore = stores.utxosStore;
        const SettingsStore = stores.settingsStore;
        const { utxos, loading } = UTXOStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

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
                                                    utxosSelected.includes(
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
                                        )}
                                        keyExtractor={item => item.txid}
                                        onEndReachedThreshold={50}
                                        refreshing={loading}
                                    />

                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                'components.UTXOPicker.modal.set'
                                            )}
                                            onPress={() => {
                                                const selected = this.state
                                                    .utxosSelected;
                                                this.setState({
                                                    showUtxoModal: false,
                                                    utxosSet: selected
                                                });

                                                onValueChange(selected);
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
                        <Picker
                            selectedValue={selectedValue}
                            onValueChange={(itemValue: string) => {
                                if (itemValue === 'Clear selection') {
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
