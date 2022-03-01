import * as React from 'react';
import {
    FlatList,
    Modal,
    StyleSheet,
    View,
    Text,
    TouchableOpacity
} from 'react-native';
import { ListItem } from 'react-native-elements';
import remove from 'lodash/remove';
import { inject, observer } from 'mobx-react';

import Button from './../components/Button';

import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import stores from './../stores/Stores';
import UTXOsStore from './../stores/UTXOsStore';

interface UTXOPickerProps {
    title?: string;
    displayValue?: string;
    onValueChange: (value: any, balance: number) => void;
    UTXOsStore: UTXOsStore;
}

interface UTXOPickerState {
    utxosSelected: string[];
    utxosSet: string[];
    showUtxoModal: boolean;
    selectedBalance: number;
    setBalance: number;
}

const DEFAULT_TITLE = localeString('components.UTXOPicker.defaultTitle');

@inject('UTXOsStore')
@observer
export default class UTXOPicker extends React.Component<
    UTXOPickerProps,
    UTXOPickerState
> {
    state = {
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
            newArray = remove(newArray, function (n) {
                return n !== itemId;
            });
            balance = selectedBalance - Number(item.getAmount);
        }

        this.setState({ utxosSelected: newArray, selectedBalance: balance });
    }

    render() {
        const { title, onValueChange, UTXOsStore } = this.props;
        const { utxosSelected, utxosSet, showUtxoModal, selectedBalance } =
            this.state;
        const { utxos, loading, getUTXOs } = UTXOsStore;

        const utxosPicked: string[] = [];
        utxosSelected.forEach((utxo: string) => utxosPicked.push(utxo));

        return (
            <React.Fragment>
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={showUtxoModal}
                >
                    <View style={styles.centeredView}>
                        <View
                            style={{
                                ...styles.modal,
                                backgroundColor: themeColor('background')
                            }}
                        >
                            {showUtxoModal && (
                                <>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('text'),
                                            fontSize: 25
                                        }}
                                    >
                                        {localeString(
                                            'components.UTXOPicker.modal.title'
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
                                            'components.UTXOPicker.modal.description'
                                        )}
                                    </Text>

                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('text'),
                                            fontSize: 20,
                                            paddingTop: 20,
                                            paddingBottom: 20
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
                                                    backgroundColor:
                                                        themeColor('background')
                                                }}
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
                                            secondary
                                        />
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>

                <View>
                    <Text
                        style={{
                            ...styles.secondaryText,
                            color: themeColor('secondaryText')
                        }}
                    >
                        {title || DEFAULT_TITLE}
                    </Text>
                    {utxosSet.length > 0 ? (
                        <TouchableOpacity onPress={() => this.clearSelection()}>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text'),
                                    padding: 10,
                                    fontSize: 16
                                }}
                            >
                                {this.displayValues()}
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
                                    'components.UTXOPicker.selectUTXOs'
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
    secondaryText: {
        fontFamily: 'Lato-Regular'
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
