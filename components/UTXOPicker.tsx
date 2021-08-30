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
import { ListItem } from 'react-native-elements';
import remove from 'lodash/remove';
import { inject, observer } from 'mobx-react';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import stores from './../stores/Stores';
import UTXOsStore from './../stores/UTXOsStore';

import Bitcoin from './../images/SVG/Bitcoin Circle.svg';

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
        const itemId: string = item.getOutpoint;
        let balance;
        if (!newArray.includes(itemId)) {
            newArray.push(itemId);
            balance = selectedBalance + Number(item.getAmount);
        } else {
            newArray = remove(newArray, function(n) {
                return n !== itemId;
            });
            balance = selectedBalance - Number(item.getAmount);
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
        const { utxos, loading, getUTXOs } = UTXOsStore;

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
                        <View style={styles.modal}>
                            {showUtxoModal && (
                                <>
                                    <Text
                                        style={{
                                            fontSize: 25,
                                            color: themeColor('text')
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
                                            color: themeColor('text')
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
                                            color: themeColor('text')
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
                                                title={item.getOutpoint}
                                                subtitle={`${item.getAmount.toString()} ${localeString(
                                                    'views.Send.satoshis'
                                                )}`}
                                                containerStyle={{
                                                    borderBottomWidth: 0,
                                                    backgroundColor: themeColor(
                                                        'background'
                                                    )
                                                }}
                                                leftElement={
                                                    utxosPicked.includes(
                                                        item.getOutpoint
                                                    )
                                                        ? Bitcoin
                                                        : null
                                                }
                                                onPress={() =>
                                                    this.toggleItem(item)
                                                }
                                                titleStyle={{
                                                    color: utxosPicked.includes(
                                                        item.getOutpoint
                                                    )
                                                        ? 'orange'
                                                        : themeColor('text')
                                                }}
                                                subtitleStyle={{
                                                    color: utxosPicked.includes(
                                                        item.getOutpoint
                                                    )
                                                        ? 'orange'
                                                        : themeColor(
                                                              'secondaryText'
                                                          )
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
                                color: themeColor('text'),
                                textDecorationLine: 'underline'
                            }}
                        >
                            {title || DEFAULT_TITLE}
                        </Text>
                        {utxosSet.length > 0 ? (
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
                                    {this.displayValues()}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <Picker
                                selectedValue={`${selectedValue}`}
                                onValueChange={(itemValue: string) => {
                                    if (itemValue === 'No selection') {
                                        this.clearSelection();
                                    } else if (
                                        itemValue === 'Select UTXOs to use'
                                    ) {
                                        this.openPicker();
                                    }
                                }}
                                style={styles.picker}
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
        color: themeColor('text')
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    },
    modal: {
        margin: 20,
        color: themeColor('text'),
        backgroundColor: themeColor('background'),
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
