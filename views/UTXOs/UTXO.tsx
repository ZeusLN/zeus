import * as React from 'react';
import {
    StyleSheet,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Amount from './../../components/Amount';
import Header from '../../components/Header';
import KeyValue from './../../components/KeyValue';
import Screen from './../../components/Screen';

import Utxo from './../../models/Utxo';

import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import UrlUtils from './../../utils/UrlUtils';

import NodeInfoStore from './../../stores/NodeInfoStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TextInput } from 'react-native-gesture-handler';

interface UTXOProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    route: Route<'UTXO', { utxo: Utxo; onLabelUpdate?: () => void }>;
}

interface UTXOState {
    label: string;
    editingLabel: string;
}

@inject('NodeInfoStore')
@observer
export default class UTXO extends React.Component<UTXOProps, UTXOState> {
    textInputRef = React.createRef<TextInput>();

    constructor(props: UTXOProps) {
        super(props);

        this.state = {
            label: '',
            editingLabel: ''
        };
    }

    async UNSAFE_componentWillMount() {
        const utxo = this.props.route.params?.utxo;
        const key = `${utxo.txid}:${utxo.output}`;
        const label = await AsyncStorage.getItem(key);
        if (label) {
            this.setState({ label, editingLabel: label });
        }
    }

    handleLabelChange = (text: string) => {
        this.setState({ editingLabel: text });
    };

    handleSaveLabel = async () => {
        const utxo = this.props.route.params?.utxo;
        const key = `${utxo.txid}:${utxo.output}`;
        await AsyncStorage.setItem(key, this.state.editingLabel);
        this.setState({ label: this.state.editingLabel });

        this.textInputRef.current?.blur();

        const onLabelUpdate = this.props.route.params?.onLabelUpdate;
        if (onLabelUpdate) {
            onLabelUpdate();
        }
    };

    render() {
        const { NodeInfoStore, navigation, route } = this.props;
        const utxo = route.params?.utxo;
        const { testnet } = NodeInfoStore;

        const { getOutpoint, address, getConfs, isUnconfirmed, blockheight } =
            utxo;
        const amount = utxo.getAmount;
        const tx = utxo.txid || utxo.outpoint.txid_str;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.utxo'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.center}>
                        <Amount sats={amount} jumboText toggleable sensitive />
                    </View>

                    <KeyValue
                        keyValue={localeString('general.outpoint')}
                        value={getOutpoint}
                    />

                    {!!address && (
                        <KeyValue
                            keyValue={localeString('general.address')}
                            value={
                                <TouchableOpacity
                                    onPress={() =>
                                        UrlUtils.goToBlockExplorerAddress(
                                            address,
                                            testnet
                                        )
                                    }
                                >
                                    <Text
                                        style={{
                                            ...styles.valueWithLink,
                                            color: themeColor('highlight')
                                        }}
                                    >
                                        {address}
                                    </Text>
                                </TouchableOpacity>
                            }
                            sensitive
                        />
                    )}

                    <KeyValue
                        keyValue={localeString(
                            'views.Transaction.transactionHash'
                        )}
                        value={
                            <TouchableOpacity
                                onPress={() =>
                                    UrlUtils.goToBlockExplorerTXID(tx, testnet)
                                }
                            >
                                <Text
                                    style={{
                                        ...styles.valueWithLink,
                                        color: themeColor('highlight')
                                    }}
                                >
                                    {tx}
                                </Text>
                            </TouchableOpacity>
                        }
                        sensitive
                    />

                    {!!getConfs && (
                        <KeyValue
                            keyValue={localeString('views.Transaction.numConf')}
                            value={getConfs}
                            color={isUnconfirmed ? 'red' : 'green'}
                            sensitive
                        />
                    )}

                    {blockheight && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Transaction.blockHeight'
                            )}
                            value={blockheight}
                            sensitive
                        />
                    )}

                    <KeyValue
                        keyValue="Label"
                        value={this.state.label || '—'}
                        sensitive
                    />

                    <View style={styles.labelContainer}>
                        <Text style={styles.labelHeading}>
                            {localeString('views.UTXOs.addLabel')}
                        </Text>
                        <TextInput
                            ref={this.textInputRef}
                            style={styles.textInput}
                            value={this.state.editingLabel}
                            onChangeText={this.handleLabelChange}
                            placeholder={localeString(
                                'views.UTXOs.savePlaceholder'
                            )}
                            placeholderTextColor={themeColor('secondaryText')}
                        />
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={this.handleSaveLabel}
                        >
                            <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    },
    valueWithLink: {
        paddingBottom: 5,
        fontFamily: 'PPNeueMontreal-Book'
    },
    labelContainer: {
        marginTop: 20
    },
    labelHeading: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 16,
        color: themeColor('secondaryText'),
        marginBottom: 8
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book',
        color: themeColor('text'),
        backgroundColor: themeColor('background')
    },
    saveButton: {
        marginTop: 10,
        backgroundColor: themeColor('highlight'),
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center'
    },
    saveButtonText: {
        color: themeColor('text'),
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Medium'
    }
});
