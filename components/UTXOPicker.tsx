import * as React from 'react';
import {
    Dimensions,
    FlatList,
    ListRenderItemInfo,
    StyleSheet,
    View,
    Text,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';

import AccountFilter from '../components/AccountFilter';
import Amount from './Amount';
import Button from '../components/Button';
import LoadingIndicator from './LoadingIndicator';
import ModalBox from './ModalBox';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import UTXOsStore from '../stores/UTXOsStore';
import storage from '../storage';

import Utxo from '../models/Utxo';

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
    clearedDraftInModal: boolean;
}

const DEFAULT_TITLE = localeString('components.UTXOPicker.defaultTitle');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

@inject('UTXOsStore')
@observer
export default class UTXOPicker extends React.Component<
    UTXOPickerProps,
    UTXOPickerState
> {
    private _isMounted = false;

    state: UTXOPickerState = {
        utxosSelected: [],
        utxosSet: [],
        showUtxoModal: false,
        selectedBalance: 0,
        setBalance: 0,
        account: 'default',
        utxoLabels: {},
        clearedDraftInModal: false
    };

    componentDidMount() {
        this._isMounted = true;
        const { UTXOsStore } = this.props;
        const { account } = this.state;
        const { getUTXOs, listAccounts } = UTXOsStore;

        getUTXOs({ account });
        if (BackendUtils.supportsAccounts()) {
            listAccounts();
        }
    }

    componentDidUpdate(prevProps: UTXOPickerProps) {
        const { UTXOsStore } = this.props;
        const prev = prevProps.UTXOsStore;
        const utxosChanged = prev.utxos !== UTXOsStore.utxos;
        const finishedLoading = prev.loading && !UTXOsStore.loading;
        if (!UTXOsStore.loading && (utxosChanged || finishedLoading)) {
            void this.loadLabels();
        }
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    private async loadLabels() {
        const { utxos } = this.props.UTXOsStore;
        const results = await Promise.all(
            utxos.map(async (utxo) => {
                const key = utxo.getOutpoint;
                if (!key) return null;
                const label = await storage.getItem(key);
                return label ? { key, label } : null;
            })
        );
        if (!this._isMounted) return;

        const utxoLabels: Record<string, string> = {};
        for (const res of results) {
            if (res) {
                utxoLabels[res.key] = res.label;
            }
        }
        this.setState({ utxoLabels });
    }

    openPicker() {
        const { utxosSet, setBalance, account } = this.state;
        const { UTXOsStore } = this.props;

        UTXOsStore.getUTXOs({ account });

        if (utxosSet.length === 0) {
            this.setState({
                utxosSelected: [],
                showUtxoModal: true,
                selectedBalance: 0,
                clearedDraftInModal: false
            });
            return;
        }

        const known = new Map<string, number>();
        for (const u of UTXOsStore.utxos) {
            const op = u.getOutpoint;
            if (!op) continue;
            known.set(op, Number(u.getAmount));
        }
        const restored: string[] = [];
        let balance = 0;
        for (const id of utxosSet) {
            const amt = known.get(id);
            if (amt != null) {
                restored.push(id);
                balance += amt;
            }
        }

        this.setState({
            showUtxoModal: true,
            utxosSelected: restored.length > 0 ? restored : [...utxosSet],
            selectedBalance: restored.length > 0 ? balance : setBalance,
            clearedDraftInModal: false
        });
    }

    closePicker = () => {
        const { clearedDraftInModal, account } = this.state;
        if (clearedDraftInModal) {
            this.props.onValueChange([], 0, account);
            this.setState({
                showUtxoModal: false,
                clearedDraftInModal: false,
                utxosSet: [],
                utxosSelected: [],
                setBalance: 0,
                selectedBalance: 0
            });
            return;
        }
        this.setState({ showUtxoModal: false, clearedDraftInModal: false });
    };

    clearPickerSelection = () => {
        this.setState({
            utxosSelected: [],
            selectedBalance: 0,
            clearedDraftInModal: true
        });
    };

    clearSelection() {
        this.setState({
            utxosSelected: [],
            utxosSet: [],
            selectedBalance: 0,
            setBalance: 0,
            clearedDraftInModal: false
        });
        this.props.onValueChange([], 0, this.state.account);
    }

    formatOutpoints(outpoints: string[]): string {
        const display: string[] = [];
        outpoints.forEach((utxo: string) => {
            const length: number = utxo.length;
            const pre: string = utxo.slice(0, 4);
            const post: string = utxo.slice(length - 4, length);
            display.push(`${pre}...${post}`);
        });
        return display.join(', ');
    }

    toggleItem(item: Utxo) {
        const { utxosSelected, selectedBalance } = this.state;
        const itemId = item.getOutpoint;
        if (!itemId) return;

        const amt = Number(item.getAmount);

        if (!utxosSelected.includes(itemId)) {
            this.setState({
                utxosSelected: [...utxosSelected, itemId],
                selectedBalance: selectedBalance + amt,
                clearedDraftInModal: false
            });
            return;
        }

        this.setState({
            utxosSelected: utxosSelected.filter((id) => id !== itemId),
            selectedBalance: Math.max(0, selectedBalance - amt),
            clearedDraftInModal: false
        });
    }

    private renderUtxoItem = (
        { item }: ListRenderItemInfo<Utxo>,
        selectedSet: Set<string>
    ) => {
        const key = item.getOutpoint;
        if (!key) {
            return null;
        }
        const message = this.state.utxoLabels[key];

        const selected = selectedSet.has(key);

        return (
            <TouchableOpacity
                style={{
                    ...styles.utxoRow
                }}
                onPress={() => this.toggleItem(item)}
                activeOpacity={0.65}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
            >
                <View style={styles.rowTop}>
                    <Text
                        style={[
                            styles.utxoOutpoint,
                            {
                                color: selected
                                    ? themeColor('highlight')
                                    : themeColor('text')
                            }
                        ]}
                    >
                        {key}
                    </Text>
                    {selected && (
                        <Text
                            style={[
                                styles.utxoCheck,
                                { color: themeColor('highlight') }
                            ]}
                        >
                            ✓
                        </Text>
                    )}
                </View>
                <View style={styles.utxoAmountLine}>
                    <Amount
                        sats={item.getAmount}
                        sensitive={true}
                        color={selected ? 'highlight' : 'secondaryText'}
                    />
                </View>
                {message ? (
                    <Text
                        style={[
                            styles.utxoLabel,
                            { color: themeColor('secondaryText') }
                        ]}
                    >
                        {`${localeString('general.label')}: ${message}`}
                    </Text>
                ) : null}
            </TouchableOpacity>
        );
    };

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
        const selectedSet = new Set(utxosSelected);

        return (
            <React.Fragment>
                <ModalBox
                    isOpen={showUtxoModal}
                    style={{
                        ...styles.sheet,
                        backgroundColor: themeColor('modalBackground'),
                        height: SCREEN_HEIGHT * 0.9
                    }}
                    swipeToClose={true}
                    backdropPressToClose={true}
                    backButtonClose={true}
                    position="bottom"
                    coverScreen={true}
                    onClosed={this.closePicker}
                >
                    <View style={styles.sheetInner}>
                        <View
                            style={{
                                ...styles.handle,
                                backgroundColor: themeColor('secondaryText')
                            }}
                        />

                        <Text
                            style={[
                                styles.sheetTitle,
                                { color: themeColor('text') }
                            ]}
                        >
                            {localeString('components.UTXOPicker.modal.title')}
                        </Text>
                        <Text
                            style={[
                                styles.sheetDescription,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {localeString(
                                'components.UTXOPicker.modal.description'
                            )}
                        </Text>

                        <View style={styles.amountBlock}>
                            <Amount
                                sats={selectedBalance}
                                sensitive={true}
                                toggleable
                                jumboText
                            />
                            <View style={styles.selectionMetaRow}>
                                <Text
                                    style={[
                                        styles.selectionMetaText,
                                        { color: themeColor('secondaryText') }
                                    ]}
                                >
                                    {`${localeString('general.selected')}: ${
                                        utxosSelected.length
                                    }`}
                                </Text>
                                {utxosSelected.length > 0 && (
                                    <TouchableOpacity
                                        onPress={this.clearPickerSelection}
                                        accessibilityRole="button"
                                        accessibilityLabel={localeString(
                                            'general.clear'
                                        )}
                                    >
                                        <Text
                                            style={[
                                                styles.selectionMetaAction,
                                                {
                                                    color: themeColor(
                                                        'highlight'
                                                    )
                                                }
                                            ]}
                                        >
                                            {localeString('general.clear')}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {BackendUtils.supportsAccounts() && (
                            <AccountFilter
                                default={account}
                                items={accounts.filter(
                                    (item: any) => !item.hidden
                                )}
                                refresh={(newAccount: string) => {
                                    getUTXOs({ account: newAccount });
                                    this.setState({ account: newAccount });
                                }}
                                onChangeAccount={() => {
                                    this.setState({
                                        utxosSelected: [],
                                        selectedBalance: 0,
                                        clearedDraftInModal: false
                                    });
                                }}
                            />
                        )}

                        <View
                            style={{
                                ...styles.body,
                                backgroundColor: themeColor('background')
                            }}
                        >
                            {loading ? (
                                <View style={styles.loadingWrap}>
                                    <LoadingIndicator />
                                </View>
                            ) : utxos.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Text
                                        style={[
                                            styles.text,
                                            {
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }
                                        ]}
                                    >
                                        {localeString(
                                            'views.UTXOs.CoinControl.noUTXOs'
                                        )}
                                    </Text>
                                </View>
                            ) : (
                                <FlatList
                                    showsVerticalScrollIndicator={false}
                                    data={utxos}
                                    contentContainerStyle={styles.listContent}
                                    extraData={utxosSelected}
                                    renderItem={(info) =>
                                        this.renderUtxoItem(info, selectedSet)
                                    }
                                    keyExtractor={(item: Utxo) =>
                                        item.getOutpoint ??
                                        `${item.txid}:${String(item.output)}`
                                    }
                                    onEndReachedThreshold={50}
                                    refreshing={loading}
                                    onRefresh={() => getUTXOs({ account })}
                                />
                            )}
                        </View>

                        <View style={styles.footer}>
                            <View style={styles.footerButton}>
                                <Button
                                    title={localeString(
                                        'components.UTXOPicker.modal.set'
                                    )}
                                    disabled={
                                        loading ||
                                        utxos.length === 0 ||
                                        utxosSelected.length === 0
                                    }
                                    onPress={() => {
                                        const {
                                            utxosSelected,
                                            selectedBalance
                                        } = this.state;
                                        this.setState({
                                            showUtxoModal: false,
                                            clearedDraftInModal: false,
                                            utxosSet: utxosSelected,
                                            setBalance: selectedBalance
                                        });

                                        onValueChange(
                                            utxosSelected,
                                            selectedBalance,
                                            account
                                        );
                                    }}
                                />
                            </View>

                            <View style={styles.footerButton}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={this.closePicker}
                                    secondary
                                />
                            </View>
                        </View>
                    </View>
                </ModalBox>

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
                        <View style={styles.committedRow}>
                            <TouchableOpacity
                                style={styles.committedValue}
                                onPress={() => this.openPicker()}
                                accessibilityRole="button"
                                accessibilityLabel={localeString(
                                    'components.UTXOPicker.selectUTXOs'
                                )}
                            >
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text'),
                                        paddingTop: 10,
                                        paddingLeft: 10,
                                        fontSize: 16
                                    }}
                                >
                                    {this.formatOutpoints(utxosSet)}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => this.clearSelection()}
                                accessibilityRole="button"
                                accessibilityLabel={localeString(
                                    'general.clear'
                                )}
                            >
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('highlight'),
                                        fontSize: 16,
                                        paddingLeft: 12,
                                        paddingTop: 10
                                    }}
                                >
                                    {localeString('general.clear')}
                                </Text>
                            </TouchableOpacity>
                        </View>
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
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 16,
        paddingBottom: 16,
        paddingHorizontal: 10
    },
    sheetInner: {
        flex: 1
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 12,
        opacity: 0.6
    },
    sheetTitle: {
        fontSize: 20,
        fontWeight: '600',
        paddingTop: 4,
        textAlign: 'center',
        fontFamily: 'PPNeueMontreal-Book'
    },
    sheetDescription: {
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        paddingTop: 10,
        paddingBottom: 10
    },
    amountBlock: {
        paddingBottom: 10,
        alignItems: 'center'
    },
    selectionMetaRow: {
        marginTop: 10,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    selectionMetaText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14
    },
    selectionMetaAction: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 24,
        alignItems: 'center'
    },
    body: {
        flex: 1,
        minHeight: 120,
        padding: 10
    },
    listContent: {
        paddingBottom: 12,
        paddingTop: 12
    },
    utxoRow: {
        flexDirection: 'column',
        paddingVertical: 12
    },
    utxoOutpoint: {
        flex: 1,
        alignSelf: 'flex-start',
        fontFamily: 'PPNeueMontreal-Book'
    },
    utxoCheck: {
        paddingLeft: 10,
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    utxoAmountLine: {
        alignSelf: 'flex-start',
        marginTop: 2
    },
    utxoLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 13,
        marginTop: 4,
        alignSelf: 'flex-start'
    },
    rowTop: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center'
    },
    footer: {
        paddingTop: 8,
        paddingBottom: 12
    },
    footerButton: {
        paddingTop: 10,
        paddingBottom: 10
    },
    committedRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    committedValue: {
        flex: 1,
        flexShrink: 1
    }
});
