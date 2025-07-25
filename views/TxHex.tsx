import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { ButtonGroup } from 'react-native-elements';
import { UR, UREncoder } from '@ngraveio/bc-ur';
import clone from 'lodash/clone';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

const bitcoin = require('bitcoinjs-lib');

import Amount from '../components/Amount';
import Button from '../components/Button';
import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import { WarningMessage } from '../components/SuccessErrorMessage';

import Base64Utils from '../utils/Base64Utils';
import { splitQRs } from '../utils/BbqrUtils';
import { localeString } from '../utils/LocaleUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import ChannelsStore from '../stores/ChannelsStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import TransactionsStore from '../stores/TransactionsStore';
import {
    getQRAnimationInterval,
    QRAnimationSpeed
} from '../utils/QRAnimationUtils';

interface TxHexProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    TransactionsStore: TransactionsStore;
    route: Route<'TxHex', { txHex: string; hideWarning?: boolean }>;
}

interface TxHexState {
    infoIndex: number;
    selectedIndex: number;
    txHex: string;
    frameIndex: number;
    bbqrParts: Array<string>;
    bcurEncoder: any;
    bcurPart: string;
    txDecoded?: any;
    qrAnimationSpeed: QRAnimationSpeed;
}

@inject('ChannelsStore', 'NodeInfoStore', 'TransactionsStore')
@observer
export default class TxHex extends React.Component<TxHexProps, TxHexState> {
    private qrAnimationInterval?: any;
    state: TxHexState = {
        infoIndex: 0,
        selectedIndex: 0,
        txHex: '',
        frameIndex: 0,
        bbqrParts: [],
        bcurEncoder: undefined,
        bcurPart: '',
        txDecoded: undefined,
        qrAnimationSpeed: 'medium'
    };

    UNSAFE_componentWillMount(): void {
        const { route } = this.props;
        const txHex = route.params?.txHex;
        this.setState({ txHex }, () => this.generateInfo());
    }

    generateInfo = () => {
        const { txHex } = this.state;

        // TX data
        const txDecoded = bitcoin.Transaction.fromHex(txHex);

        // BBQr

        const input = Base64Utils.base64ToBytes(txHex);

        const fileType = 'T'; // 'T' is for Transaction

        const splitResult = splitQRs(input, fileType, {
            // these are optional - default values are shown
            encoding: 'Z', // Zlib compressed base32 encoding
            minSplit: 4, // minimum number of parts to return
            maxSplit: 1295, // maximum number of parts to return
            minVersion: 5, // minimum QR code version
            maxVersion: 40 // maximum QR code version
        });

        // bc-ur

        const messageBuffer = Buffer.from(txHex);

        // First step is to create a UR object from a Buffer
        const ur = UR.fromBuffer(messageBuffer);

        // Then, create the UREncoder object

        // The maximum amount of fragments to be generated in total
        // For NGRAVE ZERO support please keep to a maximum fragment size of 200
        const maxFragmentLength = 200;

        // The index of the fragment that will be the first to be generated
        // If it's more than the "maxFragmentLength", then all the subsequent fragments will only be
        // fountain parts
        const firstSeqNum = 0;

        // Create the encoder object
        const encoder = new UREncoder(ur, maxFragmentLength, firstSeqNum);
        //

        this.setState({
            bcurEncoder: encoder,
            bbqrParts: splitResult.parts,
            txDecoded
        });

        // Clear any existing interval
        if (this.qrAnimationInterval) {
            clearInterval(this.qrAnimationInterval);
        }

        const length = splitResult.parts.length;
        const interval = getQRAnimationInterval(this.state.qrAnimationSpeed);
        this.qrAnimationInterval = setInterval(() => {
            this.setState({
                frameIndex:
                    this.state.frameIndex === length - 1
                        ? 0
                        : this.state.frameIndex + 1,
                bcurPart: this.state.bcurEncoder?.nextPart() || undefined
            });
        }, interval);
    };

    componentWillUnmount() {
        if (this.qrAnimationInterval) {
            clearInterval(this.qrAnimationInterval);
        }
    }

    render() {
        const { ChannelsStore, NodeInfoStore, TransactionsStore, navigation } =
            this.props;
        const { pending_chan_ids } = ChannelsStore;
        const { testnet } = NodeInfoStore;
        const { loading } = TransactionsStore;
        const {
            infoIndex,
            selectedIndex,
            frameIndex,
            bbqrParts,
            txHex,
            bcurPart,
            txDecoded,
            qrAnimationSpeed
        } = this.state;

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

        const singleButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        selectedIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('views.PSBT.singleFrame')}
            </Text>
        );
        const bcurButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        selectedIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                BC-ur
            </Text>
        );
        const bbqrButton = () => (
            <Text
                style={{
                    ...styles.text,
                    color:
                        selectedIndex === 2
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                BBQr
            </Text>
        );

        const qrButtons: any = [
            { element: singleButton },
            { element: bcurButton },
            { element: bbqrButton }
        ];

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
                                selectedButtonStyle={{
                                    backgroundColor: themeColor('highlight'),
                                    borderRadius: 12
                                }}
                                containerStyle={{
                                    backgroundColor: themeColor('secondary'),
                                    borderRadius: 12,
                                    borderColor: themeColor('secondary'),
                                    marginBottom: 10
                                }}
                                innerBorderStyle={{
                                    color: themeColor('secondary')
                                }}
                            />
                            {infoIndex === 0 && (
                                <>
                                    <ButtonGroup
                                        onPress={(selectedIndex: number) => {
                                            this.setState({ selectedIndex });
                                        }}
                                        selectedIndex={selectedIndex}
                                        buttons={qrButtons}
                                        selectedButtonStyle={{
                                            backgroundColor:
                                                themeColor('highlight'),
                                            borderRadius: 12
                                        }}
                                        containerStyle={{
                                            backgroundColor:
                                                themeColor('secondary'),
                                            borderRadius: 12,
                                            borderColor:
                                                themeColor('secondary'),
                                            marginBottom: 10
                                        }}
                                        innerBorderStyle={{
                                            color: themeColor('secondary')
                                        }}
                                    />
                                    <View
                                        style={{
                                            margin: 10
                                        }}
                                    >
                                        <CollapsedQR
                                            value={
                                                selectedIndex === 0
                                                    ? txHex
                                                    : selectedIndex === 2
                                                    ? bbqrParts[frameIndex]
                                                    : bcurPart
                                            }
                                            showSpeed={selectedIndex !== 0}
                                            copyValue={txHex}
                                            truncateLongValue
                                            expanded
                                            qrAnimationSpeed={qrAnimationSpeed}
                                            onQRAnimationSpeedChange={(
                                                speed
                                            ) => {
                                                this.setState(
                                                    {
                                                        qrAnimationSpeed: speed
                                                    },
                                                    () => {
                                                        this.generateInfo();
                                                    }
                                                );
                                            }}
                                        />
                                    </View>
                                    <View style={styles.button}>
                                        <Button
                                            title={localeString(
                                                pending_chan_ids.length > 0
                                                    ? 'views.TxHex.finalizeFlowAndBroadcast'
                                                    : 'views.TxHex.broadcast'
                                            )}
                                            onPress={() => {
                                                if (
                                                    pending_chan_ids.length > 0
                                                ) {
                                                    TransactionsStore.finalizeTxHexAndBroadcastChannel(
                                                        txHex,
                                                        pending_chan_ids
                                                    ).then(() => {
                                                        navigation.navigate(
                                                            'SendingOnChain'
                                                        );
                                                    });
                                                } else {
                                                    TransactionsStore.broadcast(
                                                        txHex
                                                    ).then(() => {
                                                        navigation.navigate(
                                                            'SendingOnChain'
                                                        );
                                                    });
                                                }
                                            }}
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
                                                                                    outpoint
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
                                                                                    address
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
