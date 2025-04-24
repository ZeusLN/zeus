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
import Button from '../../components/Button';
import store from '../../storage';

interface UTXOProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    route: Route<'UTXO', { utxo: Utxo; onLabelUpdate?: () => void }>;
}

interface UTXOState {
    storedLabel: string;
}

@inject('NodeInfoStore')
@observer
export default class UTXO extends React.Component<UTXOProps, UTXOState> {
    state = {
        storedLabel: ''
    };

    async componentDidMount() {
        const { navigation } = this.props;
        const { utxo } = this.props.route?.params;

        navigation.addListener('focus', async () => {
            const key = utxo.getOutpoint;
            const storedLabel = await store.getItem(key!);
            this.setState({ storedLabel: storedLabel || '' });
        });

        const key = utxo.getOutpoint;
        const storedLabel = await store.getItem(key!);
        this.setState({ storedLabel: storedLabel || '' });
    }

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
                <View style={styles.container}>
                    <ScrollView
                        style={styles.content}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.scrollContent}
                    >
                        <View style={styles.center}>
                            <Amount
                                sats={amount}
                                jumboText
                                toggleable
                                sensitive
                            />
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
                                            style={[
                                                styles.valueWithLink,
                                                {
                                                    color: themeColor(
                                                        'highlight'
                                                    )
                                                }
                                            ]}
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
                                        UrlUtils.goToBlockExplorerTXID(
                                            tx,
                                            testnet
                                        )
                                    }
                                >
                                    <Text
                                        style={[
                                            styles.valueWithLink,
                                            { color: themeColor('highlight') }
                                        ]}
                                    >
                                        {tx}
                                    </Text>
                                </TouchableOpacity>
                            }
                            sensitive
                        />

                        {!!getConfs && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Transaction.numConf'
                                )}
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

                        {this.state.storedLabel && (
                            <KeyValue
                                keyValue="Label"
                                value={this.state.storedLabel}
                                sensitive
                            />
                        )}
                    </ScrollView>

                    <View
                        style={[
                            styles.buttonContainer,
                            { backgroundColor: themeColor('background') }
                        ]}
                    >
                        {utxo.getOutpoint && (
                            <Button
                                title={
                                    this.state.storedLabel
                                        ? localeString(
                                              'views.UTXOs.UpdateLabel'
                                          )
                                        : localeString('views.UTXOs.AddLabel')
                                }
                                onPress={() =>
                                    navigation.navigate('AddNotes', {
                                        noteKey: utxo.getOutpoint,
                                        context: 'label'
                                    })
                                }
                                noUppercase
                            />
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
    },
    content: {
        flex: 1,
        paddingLeft: 20,
        paddingRight: 20
    },
    scrollContent: {
        paddingBottom: 20
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
    buttonContainer: {
        paddingHorizontal: 20,
        paddingBottom: 15,
        width: '100%'
    }
});
