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

import AccountFilter from '../components/AccountFilter';
import Amount from './Amount';
import Button from '../components/Button';
import LoadingIndicator from './LoadingIndicator';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import { utxosStore } from '../stores/Stores';
import UTXOsStore from '../stores/UTXOsStore';
import storage from '../storage';

interface UTXOPickerProps {
    title?: string;
    displayValue?: string;
    onValueChange: (value: any, balance: number, account: string) => void;
    UTXOsStore: UTXOsStore;
}

interface UTXOPickerState {
    utxosSelected: string[];
    utxosSet: string[];
    showUtxoModal: boolean;
    selectedBalance: number;
    setBalance: number;
    account: string;
    utxoLabels: Record<string, string>;
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
        setBalance: 0,
        account: 'default',
        utxoLabels: {} as Record<string, string>
    };

    async componentDidMount() {
        const { UTXOsStore } = this.props;
        const { account } = this.state;
        const { getUTXOs, listAccounts } = UTXOsStore;

        getUTXOs({ account });
        if (BackendUtils.supportsAccounts()) {
            listAccounts();
        }

        const { utxos } = UTXOsStore;
        const utxoLabels: Record<string, string> = {};

        for (const utxo of utxos) {
            const key = utxo.getOutpoint;
            const label = await storage.getItem(key!);
            if (label) {
                utxoLabels[key] = label;
            }
        }

        this.setState({ utxoLabels });
    }

    openPicker() {
        utxosStore.getUTXOs(this.state.account);
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
        this.props.onValueChange([], 0, 'default');
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
        const {
            utxosSelected,
            utxosSet,
            showUtxoModal,
            selectedBalance,
            account
        } = this.state;
        const { utxos, loading, getUTXOs, accounts } = UTXOsStore;

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
                                backgroundColor: themeColor('secondary')
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

                                    <View
                                        style={{
                                            paddingBottom: 10
                                        }}
                                    >
                                        <Amount
                                            sats={selectedBalance}
                                            sensitive={true}
                                            toggleable
                                            jumboText
                                        />
                                    </View>

                                    {BackendUtils.supportsAccounts() && (
                                        <AccountFilter
                                            default={account}
                                            items={accounts.filter(
                                                (item: any) => !item.hidden
                                            )}
                                            refresh={(newAccount: string) => {
                                                getUTXOs({
                                                    account: newAccount
                                                });
                                                this.setState({
                                                    account: newAccount
                                                });
                                            }}
                                            onChangeAccount={() => {
                                                this.setState({
                                                    utxosSelected: [],
                                                    selectedBalance: 0
                                                });
                                            }}
                                        />
                                    )}

                                    {loading && <LoadingIndicator />}

                                    {!loading && utxos.length === 0 && (
                                        <View
                                            style={{
                                                flex: 1,
                                                marginTop: 10,
                                                alignSelf: 'center'
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.UTXOs.CoinControl.noUTXOs'
                                                )}
                                            </Text>
                                        </View>
                                    )}

                                    {!loading && utxos.length > 0 && (
                                        <FlatList
                                            data={utxos}
                                            renderItem={({ item }) => {
                                                const key = item.getOutpoint;
                                                const message =
                                                    this.state.utxoLabels[key!];

                                                return (
                                                    <ListItem
                                                        containerStyle={{
                                                            flex: 1,
                                                            flexDirection:
                                                                'column',
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
                                                        <Text
                                                            style={{
                                                                alignSelf:
                                                                    'flex-start',
                                                                color: utxosPicked.includes(
                                                                    item.getOutpoint
                                                                )
                                                                    ? themeColor(
                                                                          'highlight'
                                                                      )
                                                                    : themeColor(
                                                                          'text'
                                                                      )
                                                            }}
                                                        >
                                                            {key}
                                                        </Text>
                                                        <View
                                                            style={{
                                                                alignSelf:
                                                                    'flex-start'
                                                            }}
                                                        >
                                                            <Amount
                                                                sats={
                                                                    item.getAmount
                                                                }
                                                                sensitive={true}
                                                                color={
                                                                    utxosPicked.includes(
                                                                        item.getOutpoint
                                                                    )
                                                                        ? 'highlight'
                                                                        : 'secondaryText'
                                                                }
                                                            />
                                                        </View>
                                                        {message && (
                                                            <Text
                                                                style={{
                                                                    color: themeColor(
                                                                        'secondaryText'
                                                                    ),
                                                                    fontSize: 13,
                                                                    alignSelf:
                                                                        'flex-start'
                                                                }}
                                                            >
                                                                {`${localeString(
                                                                    'general.label'
                                                                )}: ${message}`}
                                                            </Text>
                                                        )}
                                                    </ListItem>
                                                );
                                            }}
                                            keyExtractor={(
                                                item: any,
                                                index: number
                                            ) => `${item.txid}-${index}`}
                                            onEndReachedThreshold={50}
                                            refreshing={loading}
                                            onRefresh={() => getUTXOs(account)}
                                        />
                                    )}

                                    {!loading && (
                                        <>
                                            {utxos.length > 0 && (
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
                                                                showUtxoModal:
                                                                    false,
                                                                utxosSet:
                                                                    utxosSelected,
                                                                setBalance:
                                                                    selectedBalance
                                                            });

                                                            onValueChange(
                                                                utxosSelected,
                                                                selectedBalance,
                                                                account
                                                            );
                                                        }}
                                                    />
                                                </View>
                                            )}

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
                                    paddingTop: 10,
                                    paddingLeft: 10,
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
                                    paddingTop: 10,
                                    paddingLeft: 10,
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
        fontFamily: 'PPNeueMontreal-Book'
    },
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book'
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
        elevation: 5,
        width: '95%',
        height: '95%'
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 22
    }
});
