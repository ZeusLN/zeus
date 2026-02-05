import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { ButtonGroup } from '@rneui/themed';
import clone from 'lodash/clone';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { runInAction } from 'mobx';

const bitcoin = require('bitcoinjs-lib');

import Amount from '../components/Amount';
import AnimatedQRDisplay from '../components/AnimatedQRDisplay';
import Button from '../components/Button';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import { WarningMessage } from '../components/SuccessErrorMessage';

import Base64Utils from '../utils/Base64Utils';
import { getButtonGroupStyles } from '../utils/buttonGroupStyles';
import { localeString } from '../utils/LocaleUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import ChannelsStore from '../stores/ChannelsStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import TransactionsStore from '../stores/TransactionsStore';
import SettingsStore from '../stores/SettingsStore';

interface TxHexProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    route: Route<'TxHex', { txHex: string; hideWarning?: boolean }>;
}

interface TxHexState {
    infoIndex: number;
    txHex: string;
    txDecoded?: any;
}

@inject('ChannelsStore', 'NodeInfoStore', 'TransactionsStore', 'SettingsStore')
@observer
export default class TxHex extends React.Component<TxHexProps, TxHexState> {
    state: TxHexState = {
        infoIndex: 0,
        txHex: this.props.route.params?.txHex || '',
        txDecoded: undefined
    };

    componentDidMount(): void {
        this.decodeTx();
    }

    decodeTx = () => {
        const { txHex } = this.state;
        try {
            const txDecoded = bitcoin.Transaction.fromHex(txHex);
            this.setState({ txDecoded });
        } catch (e) {
            this.setState({ txDecoded: undefined });
        }
    };

    handleBroadcast = async () => {
        const { txHex } = this.state;
        const { navigation, SettingsStore, TransactionsStore, ChannelsStore } =
            this.props;
        const { pending_chan_ids } = ChannelsStore;

        try {
            if (pending_chan_ids.length > 0) {
                await TransactionsStore.finalizeTxHexAndBroadcastChannel(
                    txHex,
                    pending_chan_ids
                );
                navigation.navigate('SendingOnChain');
                return;
            }

            if (SettingsStore.implementation === 'cln-rest') {
                const userConfirmed = await new Promise<boolean>((resolve) => {
                    Alert.alert(
                        localeString('views.TxHex.broadcastingViaMempool'),
                        localeString('views.TxHex.thirdPartyBroadcastWarning'),
                        [
                            {
                                text: localeString('general.cancel'),
                                style: 'cancel',
                                onPress: () => resolve(false)
                            },
                            { text: 'OK', onPress: () => resolve(true) }
                        ]
                    );
                });

                if (!userConfirmed) {
                    runInAction(() => {
                        TransactionsStore.error = true;
                        TransactionsStore.error_msg = localeString(
                            'views.TxHex.transactionBroadcastCancelled'
                        );
                        TransactionsStore.loading = false;
                    });
                    return;
                }
            }

            await TransactionsStore.broadcast(txHex);

            if (!TransactionsStore.error) {
                navigation.navigate('SendingOnChain');
            }
        } catch (error: any) {
            console.error('Broadcast failed:', error);

            runInAction(() => {
                TransactionsStore.error = true;
                TransactionsStore.error_msg =
                    error?.message || 'Broadcast failed';
                TransactionsStore.loading = false;
            });
        }
    };

    render() {
        const { ChannelsStore, NodeInfoStore, TransactionsStore, navigation } =
            this.props;
        const { pending_chan_ids } = ChannelsStore;
        const { testnet } = NodeInfoStore;
        const { loading } = TransactionsStore;
        const { infoIndex, txHex, txDecoded } = this.state;

        const qrButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        infoIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.PSBT.qrs')}
            </Text>
        );
        const infoButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        infoIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.TxHex.TxInfo')}
            </Text>
        );

        const infoButtons: any = [
            { element: qrButton },
            { element: infoButton }
        ];

        const groupStyles = getButtonGroupStyles();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={() => navigation.popTo('Wallet')}
                    navigateBackOnBackPress={false}
                    centerComponent={{
                        text: 'Transaction Hex',
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <ScrollView>
                    {pending_chan_ids.length > 0 && (
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    fontWeight: 'bold',
                                    color: themeColor('text'),
                                    alignSelf: 'center'
                                }}
                            >
                                {pending_chan_ids.length > 1
                                    ? localeString('views.Channel.channelIds')
                                    : localeString('views.Channel.channelId')}
                            </Text>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text'),
                                    padding: 15
                                }}
                            >
                                {pending_chan_ids.map(
                                    (pending_chan_id, index) =>
                                        `${Base64Utils.base64ToHex(
                                            pending_chan_id
                                        )}${
                                            index !==
                                            pending_chan_ids.length - 1
                                                ? ', '
                                                : ''
                                        }`
                                )}
                            </Text>
                        </>
                    )}
                    {txDecoded && txDecoded.getId() && (
                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    fontWeight: 'bold',
                                    color: themeColor('text'),
                                    alignSelf: 'center'
                                }}
                            >
                                {localeString('views.SendingOnChain.txid')}
                            </Text>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text'),
                                    padding: 15
                                }}
                            >
                                {txDecoded.getId()}
                            </Text>
                        </>
                    )}
                    {!loading &&
                        pending_chan_ids.length === 0 &&
                        !this.props.route.params?.hideWarning && (
                            <WarningMessage
                                message={localeString(
                                    'views.TxHex.channelWarning'
                                )}
                                fontSize={13}
                            />
                        )}
                    {loading && (
                        <View style={{ margin: 15 }}>
                            <LoadingIndicator />
                        </View>
                    )}
                    {!loading && txHex && (
                        <>
                            <ButtonGroup
                                onPress={(infoIndex: number) => {
                                    this.setState({ infoIndex });
                                }}
                                selectedIndex={infoIndex}
                                buttons={infoButtons}
                                selectedButtonStyle={
                                    groupStyles.selectedButtonStyle
                                }
                                containerStyle={groupStyles.containerStyle}
                                innerBorderStyle={groupStyles.innerBorderStyle}
                            />
                            {infoIndex === 0 && (
                                <>
                                    <AnimatedQRDisplay
                                        data={txHex}
                                        encoderType="transaction"
                                        fileType="T"
                                        copyValue={txHex}
                                    />
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                pending_chan_ids.length > 0
                                                    ? 'views.TxHex.finalizeFlowAndBroadcast'
                                                    : 'views.TxHex.broadcast'
                                            )}
                                            onPress={this.handleBroadcast}
                                            containerStyle={{ width: '100%' }}
                                            buttonStyle={{ height: 40 }}
                                            tertiary
                                        />
                                    </View>
                                </>
                            )}
                            {infoIndex === 1 && (
                                <View style={{ margin: 15 }}>
                                    {!txDecoded && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    alignSelf: 'center'
                                                }}
                                            >
                                                {localeString(
                                                    'views.PSBT.couldNotDecode'
                                                )}
                                            </Text>
                                        </>
                                    )}
                                    {txDecoded && (
                                        <>
                                            {txDecoded.version && (
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'general.version'
                                                    )}
                                                    value={txDecoded.version}
                                                />
                                            )}
                                            {txDecoded.ins?.length && (
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.PSBT.inputCount'
                                                    )}
                                                    value={
                                                        txDecoded.ins?.length
                                                    }
                                                />
                                            )}
                                            {txDecoded.outs?.length && (
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.PSBT.outputCount'
                                                    )}
                                                    value={
                                                        txDecoded.outs?.length
                                                    }
                                                />
                                            )}
                                            {txDecoded.ins?.map(
                                                (input: any, index: number) => {
                                                    const hash = clone(
                                                        input.hash
                                                    );
                                                    const prevTxHash = hash
                                                        .reverse()
                                                        .toString('hex');
                                                    const outpoint = `${prevTxHash}:${input.index}`;
                                                    return (
                                                        <View
                                                            key={`input-${index}`}
                                                        >
                                                            <KeyValue
                                                                keyValue={`${localeString(
                                                                    'views.PSBT.input'
                                                                )} ${
                                                                    index + 1
                                                                }`}
                                                            />
                                                            {prevTxHash && (
                                                                <KeyValue
                                                                    keyValue={localeString(
                                                                        'general.outpoint'
                                                                    )}
                                                                    value={
                                                                        <TouchableOpacity
                                                                            onPress={() =>
                                                                                UrlUtils.goToBlockExplorerTXID(
                                                                                    outpoint,
                                                                                    testnet
                                                                                )
                                                                            }
                                                                        >
                                                                            <Text
                                                                                style={{
                                                                                    ...styles.text,
                                                                                    color: themeColor(
                                                                                        'highlight'
                                                                                    )
                                                                                }}
                                                                            >
                                                                                {`${PrivacyUtils.sensitiveValue(
                                                                                    {
                                                                                        input: outpoint
                                                                                    }
                                                                                )}`}
                                                                            </Text>
                                                                        </TouchableOpacity>
                                                                    }
                                                                />
                                                            )}
                                                            {input.value && (
                                                                <KeyValue
                                                                    keyValue={localeString(
                                                                        'views.Receive.amount'
                                                                    )}
                                                                    value={
                                                                        <Amount
                                                                            sats={
                                                                                input.value ||
                                                                                0
                                                                            }
                                                                            toggleable
                                                                            sensitive
                                                                        />
                                                                    }
                                                                />
                                                            )}
                                                        </View>
                                                    );
                                                }
                                            )}
                                            {txDecoded.outs?.map(
                                                (
                                                    output: any,
                                                    index: number
                                                ) => {
                                                    // const decodedOutputScript = bitcoin.script.toASM(output.script);

                                                    // Extract address from the output script
                                                    const address =
                                                        bitcoin.address.fromOutputScript(
                                                            output.script
                                                        );
                                                    return (
                                                        <View
                                                            key={`output-${index}`}
                                                        >
                                                            <KeyValue
                                                                keyValue={`${localeString(
                                                                    'views.PSBT.output'
                                                                )} ${
                                                                    index + 1
                                                                }`}
                                                            />
                                                            {address && (
                                                                <KeyValue
                                                                    keyValue={localeString(
                                                                        'general.address'
                                                                    )}
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
                                                                                    ...styles.text,
                                                                                    color: themeColor(
                                                                                        'highlight'
                                                                                    )
                                                                                }}
                                                                            >
                                                                                {`${PrivacyUtils.sensitiveValue(
                                                                                    {
                                                                                        input: address
                                                                                    }
                                                                                )}`}
                                                                            </Text>
                                                                        </TouchableOpacity>
                                                                    }
                                                                    sensitive
                                                                />
                                                            )}
                                                            {output.value && (
                                                                <KeyValue
                                                                    keyValue={localeString(
                                                                        'views.Receive.amount'
                                                                    )}
                                                                    value={
                                                                        <Amount
                                                                            sats={
                                                                                output.value ||
                                                                                0
                                                                            }
                                                                            toggleable
                                                                            sensitive
                                                                        />
                                                                    }
                                                                />
                                                            )}
                                                        </View>
                                                    );
                                                }
                                            )}
                                        </>
                                    )}
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        padding: 10
    }
});
