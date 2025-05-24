import React from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { LinearProgress } from 'react-native-elements';

import ReactNativeBlobUtil from 'react-native-blob-util';
import { inject, observer } from 'mobx-react';
import { crypto } from 'bitcoinjs-lib';
import BigNumber from 'bignumber.js';
import bolt11 from 'bolt11';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import lndMobile from '../../lndmobile/LndMobileInjection';
const { createClaimTransaction, createReverseClaimTransaction } =
    lndMobile.swaps;

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import Amount from '../../components/Amount';
import Button from '../../components/Button';
import LoadingIndicator from '../../components/LoadingIndicator';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';
import Text from '../../components/Text';

import handleAnything from '../../utils/handleAnything';
import { localeString, pascalToHumanReadable } from '../../utils/LocaleUtils';
import { sleep } from '../../utils/SleepUtils';
import { font } from '../../utils/FontUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { numberWithCommas } from '../../utils/UnitsUtils';
import UrlUtils from '../../utils/UrlUtils';

import NodeInfoStore from '../../stores/NodeInfoStore';
import SwapStore from '../../stores/SwapStore';
import { nodeInfoStore, unitsStore } from '../../stores/Stores';

import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';
import QR from '../../assets/images/SVG/QR.svg';

interface SwapDetailsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'SwapDetails',
        {
            swapData: any;
            keys: any;
            endpoint: string;
            serviceProvider: string;
            invoice: string;
            fee: string;
        }
    >;
    NodeInfoStore?: NodeInfoStore;
    SwapStore?: SwapStore;
}

interface SwapDetailsState {
    updates: string | null;
    failureReason: string;
    error: string | { message?: string } | null;
    loading: boolean;
    socketConnected: boolean;
    swapTreeToggle: boolean;
}

@inject('NodeInfoStore', 'SwapStore')
@observer
export default class SwapDetails extends React.Component<
    SwapDetailsProps,
    SwapDetailsState
> {
    constructor(props: SwapDetailsProps) {
        super(props);
        this.state = {
            updates: null,
            failureReason: '',
            error: null,
            loading: false,
            socketConnected: true,
            swapTreeToggle: false
        };
    }

    componentDidMount() {
        const { swapData } = this.props.route.params;

        // reset units to help prevent wrong amount being sent
        unitsStore.resetUnits();

        if (!swapData) {
            console.error('No swap data provided.');
            return;
        }

        const isSubmarineSwap = Boolean(swapData.bip21);

        if (isSubmarineSwap) {
            const failedStatus = [
                'invoice.failedToPay',
                'transaction.refunded',
                'transaction.claimed',
                'transaction.lockupFailed',
                'swap.expired'
            ];

            if (failedStatus.includes(swapData?.status)) {
                this.setState({
                    updates: swapData.status,
                    socketConnected: false
                });
                return;
            }

            this.getSwapUpdates(swapData, isSubmarineSwap);
        } else {
            const failedStatus = [
                'invoice.expired',
                'transaction.refunded',
                'swap.expired'
            ];
            if (failedStatus.includes(swapData?.status)) {
                this.setState({
                    updates: swapData.status,
                    socketConnected: false
                });
                return;
            }

            this.getReverseSwapUpdates(swapData, isSubmarineSwap);
        }
    }

    renderSwapTree = (swapTree: any) => {
        const { swapTreeToggle } = this.state;
        if (!swapTree) return null;

        return (
            <View>
                <TouchableOpacity
                    onPress={() => {
                        this.setState({
                            swapTreeToggle: !swapTreeToggle
                        });
                    }}
                >
                    <View
                        style={{
                            marginTop: 10,
                            marginBottom: 10
                        }}
                    >
                        <Row justify="space-between">
                            <View style={{ width: '95%' }}>
                                <KeyValue
                                    keyValue={localeString(
                                        'views.SwapDetails.swapTree'
                                    )}
                                />
                            </View>
                            {swapTreeToggle ? (
                                <CaretDown
                                    fill={themeColor('text')}
                                    width="20"
                                    height="20"
                                />
                            ) : (
                                <CaretRight
                                    fill={themeColor('text')}
                                    width="20"
                                    height="20"
                                />
                            )}
                        </Row>
                    </View>
                </TouchableOpacity>
                {swapTreeToggle &&
                    Object.entries(swapTree).map(
                        ([key, value]: [string, any]) => {
                            key = pascalToHumanReadable(key);
                            return (
                                <View key={key}>
                                    <KeyValue keyValue={key} />
                                    {typeof value === 'object' ? (
                                        Object.entries(value).map(
                                            ([nestedKey, nestedValue]: [
                                                string,
                                                any
                                            ]) => {
                                                nestedKey =
                                                    pascalToHumanReadable(
                                                        nestedKey
                                                    );
                                                return (
                                                    <KeyValue
                                                        key={nestedKey}
                                                        keyValue={nestedKey}
                                                        value={nestedValue}
                                                    />
                                                );
                                            }
                                        )
                                    ) : (
                                        <KeyValue
                                            key={key}
                                            keyValue={key}
                                            value={value}
                                        />
                                    )}
                                </View>
                            );
                        }
                    )}
            </View>
        );
    };

    getSwapUpdates = async (createdResponse: any, isSubmarineSwap: boolean) => {
        const { keys, endpoint, invoice } = this.props.route.params;

        const { SwapStore } = this.props;

        if (!createdResponse || !createdResponse.id) {
            console.error('Invalid response:', createdResponse);
            this.setState({ error: 'Invalid response received.' });
            return;
        }

        let submitted = false;

        console.log('Connecting to WebSocket for updates...');
        this.setState({ loading: true });

        // Create a WebSocket connection
        const webSocket = new WebSocket(
            endpoint.replace('https', 'wss') + '/ws'
        );

        // Handle WebSocket connection open
        webSocket.onopen = () => {
            console.log('WebSocket connection opened');
            webSocket.send(
                JSON.stringify({
                    op: 'subscribe',
                    channel: 'swap.update',
                    args: [createdResponse.id]
                })
            );
        };

        // Handle incoming WebSocket messages
        webSocket.onmessage = async (event) => {
            const msg = JSON.parse(event.data);

            if (msg.event !== 'update') {
                return;
            }

            console.log('Got WebSocket update');
            console.log(msg);

            const data = msg.args[0];

            // Check for API errors
            if (data?.error) {
                if (data.error === 'Operation timeout') {
                    this.setState({
                        error: 'The operation timed out.',
                        loading: false,
                        socketConnected: false
                    });
                    webSocket.close();
                    return;
                }

                this.setState({
                    error: data.error,
                    loading: false,
                    socketConnected: false
                });
                webSocket.close();
                return;
            }

            // Update the status in the component state
            this.setState({
                updates: data.status,
                failureReason: data.failureReason,
                loading: false
            });

            // Update the status in Encrypted Storage
            await SwapStore?.updateSwapStatus(
                createdResponse.id,
                data.status,
                isSubmarineSwap,
                data.failureReason
            );

            switch (data.status) {
                case 'invoice.set':
                    console.log('Waiting for onchain transaction...');
                    break;
                case 'transaction.claim.pending':
                    if (submitted) {
                        console.log(
                            'Cooperative claim transaction already created and submitted successfully. Skipping.'
                        );
                    } else {
                        console.log(
                            'Creating cooperative claim transaction...'
                        );

                        const claimTxDetails = await this.fetchClaimDetails(
                            createdResponse.id,
                            endpoint
                        );
                        console.log('Fetched claim details:', claimTxDetails);

                        const isValid = this.validatePreimage(
                            claimTxDetails?.preimage,
                            invoice
                        );
                        console.log('Is valid?', isValid);

                        if (!isValid) {
                            console.error('Invalid preimage received');
                            return;
                        }

                        console.log(
                            'Preimage validated. Proceeding with claim transaction...'
                        );
                        submitted = await this.createClaimTransaction(
                            claimTxDetails,
                            createdResponse,
                            keys,
                            endpoint
                        );
                    }
                    break;

                case 'transaction.lockupFailed':
                    if (isSubmarineSwap) {
                        webSocket.close();
                        this.setState({
                            socketConnected: false
                        });
                        await SwapStore?.getLockupTransaction(
                            createdResponse.id
                        );
                    }
                    break;

                case 'transaction.claimed':
                case 'invoice.failedToPay':
                case 'swap.expired':
                    webSocket.close();
                    data?.failureReason &&
                        this.setState({
                            error: data?.failureReason,
                            socketConnected: false
                        });
                    break;

                default:
                    console.log('Unhandled status:', data.status);
            }
        };

        webSocket.onerror = (error) => {
            this.setState({
                error: error.message || error || 'An unknown error occurred',
                loading: false
            });
            console.error('WebSocket error:', error);
        };

        webSocket.onclose = () => {
            console.log('WebSocket connection closed');
        };

        this.componentWillUnmount = () => {
            if (webSocket) {
                webSocket.close();
            }
        };
    };

    getReverseSwapUpdates = (
        createdResponse: any,
        isSubmarineSwap: boolean
    ) => {
        const { keys, endpoint, swapData, fee } = this.props.route.params;

        const { SwapStore } = this.props;

        if (!createdResponse || !createdResponse.id) {
            console.error('Invalid response:', createdResponse);
            this.setState({ error: 'Invalid response received.' });
            return;
        }

        let submitted = false;

        console.log('Connecting to WebSocket for updates...');
        this.setState({ loading: true });

        // Create a WebSocket connection
        const webSocket = new WebSocket(
            endpoint.replace('https', 'wss') + '/ws'
        );

        // Handle WebSocket connection open
        webSocket.onopen = () => {
            console.log('WebSocket connection opened');
            webSocket.send(
                JSON.stringify({
                    op: 'subscribe',
                    channel: 'swap.update',
                    args: [createdResponse.id]
                })
            );
        };

        // Handle incoming WebSocket messages
        webSocket.onmessage = async (event) => {
            const msg = JSON.parse(event.data);

            if (msg.event !== 'update') {
                return;
            }

            console.log('Got WebSocket update');
            console.log(msg);

            const data = msg.args[0];

            // Check for API errors
            if (data?.error) {
                if (data.error === 'Operation timeout') {
                    this.setState({
                        error: 'The operation timed out.',
                        loading: false,
                        socketConnected: false
                    });
                    webSocket.close();
                    return;
                }

                this.setState({
                    error: data.error,
                    loading: false,
                    socketConnected: false
                });
                webSocket.close();
                return;
            }

            // Update the status in the component state
            this.setState({ updates: data.status, loading: false });

            // Update the status in Encrypted Storage
            await SwapStore?.updateSwapStatus(
                createdResponse.id,
                data.status,
                isSubmarineSwap
            );

            switch (data.status) {
                case 'swap.created':
                    console.log('Waiting for invoice to be paid');
                    break;

                case 'transaction.mempool':
                    if (submitted) {
                        console.log(
                            'Claim transaction already created and submitted successfully. Skipping.'
                        );
                    } else {
                        console.log('Creating claim transaction');

                        submitted = await this.createReverseClaimTransaction(
                            createdResponse,
                            keys,
                            endpoint,
                            swapData.lockupAddress,
                            swapData.destinationAddress,
                            swapData.preimage,
                            data.transaction.hex,
                            fee
                        );
                    }
                    break;

                case 'invoice.expired':
                case 'transaction.failed':
                case 'swap.expired':
                    webSocket.close();
                    data?.failureReason &&
                        this.setState({
                            error: data?.failureReason,
                            socketConnected: false
                        });
                    break;

                case 'invoice.settled':
                    console.log('Swap successful');
                    webSocket.close();
                    this.setState({
                        socketConnected: false
                    });
                    break;

                default:
                    console.log('Unhandled status:', data.status);
                    break;
            }
        };

        webSocket.onerror = (error) => {
            if (error.message) {
                this.setState({
                    error: error.message,
                    loading: false
                });
            }
            console.error('WebSocket error:', error);
        };

        webSocket.onclose = () => {
            console.log('WebSocket connection closed');
        };

        this.componentWillUnmount = () => {
            if (webSocket) {
                webSocket.close();
            }
        };
    };

    fetchClaimDetails = async (swapId: string, endpoint: string) => {
        const response = await ReactNativeBlobUtil.fetch(
            'GET',
            `${endpoint}/swap/submarine/${swapId}/claim`,
            { 'Content-Type': 'application/json' }
        );
        return response.json();
    };

    /**
     * Validate the preimage by comparing its hash with the invoice's payment hash.
     */
    validatePreimage = (preimage: string, invoice: string): boolean => {
        let invoicePreimageHash: any;
        let decoded: any;
        let result: any;

        try {
            decoded = bolt11.decode(invoice);
        } catch (error) {
            console.log(error);
        }

        const paymentHash = decoded.tags.find(
            (tag: any) => tag.tagName === 'payment_hash'
        );
        invoicePreimageHash = Buffer.from(paymentHash!.data || '', 'hex');

        result = crypto
            .sha256(Buffer.from(preimage, 'hex'))
            .equals(invoicePreimageHash);

        return result;
    };

    /**
     * Create and send a claim transaction
     */
    createClaimTransaction = async (
        claimTxDetails: any,
        createdResponse: any,
        keys: any,
        endpoint: string
    ): Promise<boolean> => {
        try {
            const dObject = keys.__D;

            // Extract keys, sort them numerically, and map to byte values
            const dBytes = Object.keys(dObject)
                .map((key) => parseInt(key, 10))
                .sort((a, b) => a - b)
                .map((key) => dObject[key]);

            const privateKeyHex = dBytes
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join('');

            try {
                await createClaimTransaction({
                    endpoint,
                    swapId: createdResponse.id,
                    claimLeaf: createdResponse.swapTree.claimLeaf.output,
                    refundLeaf: createdResponse.swapTree.refundLeaf.output,
                    privateKey: privateKeyHex,
                    servicePubKey: createdResponse.claimPublicKey,
                    transactionHash: claimTxDetails.transactionHash,
                    pubNonce: claimTxDetails.pubNonce
                });

                console.log('Claim transaction submitted successfully.');
                return true;
            } catch (error) {
                console.log('Error submitting claim tx', error);
                return false;
            }
        } catch (e) {
            console.log('Error creating claim tx ', e);
            return false;
        }
    };

    /**
     * Create and send a claim transaction for a reverse swap
     */
    createReverseClaimTransaction = async (
        createdResponse: any,
        keys: any,
        endpoint: string,
        lockupAddress: string,
        destinationAddress: string,
        preimage: any,
        transactionHex: string,
        fee: string
    ): Promise<boolean> => {
        try {
            const dObject = keys.__D;

            // Extract keys, sort them numerically, and map to byte values
            const dBytes = Object.keys(dObject)
                .map((key) => parseInt(key, 10))
                .sort((a, b) => a - b)
                .map((key) => dObject[key]);

            const privateKeyHex = dBytes
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join('');

            // allow some retries in case of alt network
            // tx propagation issues
            for (let i = 0; i <= 10; i++) {
                try {
                    await sleep(1000);
                    await createReverseClaimTransaction({
                        endpoint,
                        swapId: createdResponse.id,
                        claimLeaf: createdResponse.swapTree.claimLeaf.output,
                        refundLeaf: createdResponse.swapTree.refundLeaf.output,
                        privateKey: privateKeyHex,
                        servicePubKey: createdResponse.refundPublicKey,
                        preimageHex: preimage.toString('hex'),
                        transactionHex,
                        lockupAddress,
                        destinationAddress,
                        feeRate: Number(fee || 2),
                        isTestnet: this.props.NodeInfoStore!.nodeInfo.isTestNet
                    });

                    console.log(
                        'Reverse claim transaction submitted successfully.',
                        { attempt: i + 1 }
                    );
                    return true;
                } catch (error) {
                    console.log('Error submitting reverse claim tx', {
                        error,
                        attempt: i + 1
                    });
                }
            }
            return false;
        } catch (e) {
            console.log('Error creating reverse claim tx ', e);
            return false;
        }
    };

    timelockIndicator = () => {
        const swapData = this.props.route.params?.swapData ?? '';

        if (!nodeInfoStore.nodeInfo.currentBlockHeight) return '';

        if (
            new BigNumber(swapData.timeoutBlockHeight).gt(
                nodeInfoStore.nodeInfo.currentBlockHeight
            )
        ) {
            return '🔒';
        }

        return '';
    };

    render() {
        const { navigation, SwapStore } = this.props;

        const { updates, error, failureReason } = this.state;
        const swapData = this.props.route.params?.swapData ?? '';

        const serviceProvider = this.props.route.params?.serviceProvider ?? '';

        const isSubmarineSwap = !!swapData.bip21;
        const isReverseSwap = !!swapData.lockupAddress;

        const progressUpdate = isSubmarineSwap
            ? updates === 'invoice.set'
                ? localeString('views.SwapDetails.waitingForOnchainTx')
                : updates === 'transaction.mempool'
                ? localeString('views.SwapDetails.waitingForConf')
                : ''
            : updates === 'swap.created'
            ? localeString('views.SwapDetails.waitingForInvoicePayment')
            : updates === 'transaction.mempool'
            ? localeString('views.SwapDetails.waitingForConf')
            : '';

        const QRButton = () => {
            if (!swapData?.bip21 && !swapData.invoice) {
                return null;
            }

            return (
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('QR', {
                            value: isSubmarineSwap
                                ? swapData?.bip21
                                : swapData?.invoice
                        })
                    }
                >
                    <QR
                        fill={themeColor('text')}
                        style={{ alignSelf: 'center' }}
                    />
                </TouchableOpacity>
            );
        };

        const failure = failureReason || swapData.failureReason;

        const showRefundButton =
            (updates === 'invoice.failedToPay' &&
                failure === 'invoice could not be paid') ||
            updates === 'transaction.lockupFailed' ||
            (failure && error);

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.SwapDetails.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <Row style={{ gap: 10 }}>
                            {this.state.loading && (
                                <LoadingIndicator size={35} />
                            )}
                            {!this.state.loading &&
                                (updates === 'invoice.set' ||
                                    (swapData.type === 'Reverse' &&
                                        updates === 'swap.created')) && (
                                    <QRButton />
                                )}
                        </Row>
                    }
                    navigation={navigation}
                />
                <ScrollView style={{ marginHorizontal: 20 }}>
                    <View style={{ marginBottom: 15 }}>
                        <Text
                            style={{
                                textAlign: 'center',
                                fontFamily: font('marlideBold'),
                                fontSize: 28
                            }}
                        >
                            {swapData.type}
                        </Text>
                        <Text
                            style={{
                                textAlign: 'center',
                                fontFamily: font('marlide'),
                                fontSize: 22
                            }}
                        >
                            {swapData.type === 'Submarine'
                                ? 'on-chain to Lightning'
                                : 'Lightning to on-chain'}
                        </Text>
                    </View>
                    {this.state.socketConnected && (
                        <View
                            style={{
                                flex: 1,
                                justifyContent: 'center',
                                alignItems: 'center',
                                margin: 15,
                                gap: 4
                            }}
                        >
                            <LinearProgress color={themeColor('highlight')} />
                            <Text
                                style={{
                                    textAlign: 'center',
                                    fontSize: 14,
                                    fontFamily: 'PPNeueMontreal-Book',
                                    marginTop: 10
                                }}
                            >
                                {progressUpdate}
                            </Text>
                        </View>
                    )}
                    {error && (
                        <ErrorMessage
                            message={
                                typeof error === 'object' && 'message' in error
                                    ? error?.message
                                    : String(error)
                            }
                        />
                    )}

                    {updates && (
                        <KeyValue
                            keyValue={localeString('views.Channel.status')}
                            value={SwapStore?.formatStatus(updates)}
                            color={SwapStore?.statusColor(updates)}
                        />
                    )}

                    {failure && (
                        <KeyValue
                            keyValue={localeString(
                                'views.SwapSettings.failureReason'
                            )}
                            value={SwapStore?.formatStatus(failure)}
                            color={SwapStore?.statusColor(failure)}
                        />
                    )}

                    {(serviceProvider || swapData?.serviceProvider) && (
                        <KeyValue
                            keyValue={localeString('general.serviceProvider')}
                            value={serviceProvider || swapData.serviceProvider}
                        />
                    )}

                    <KeyValue
                        keyValue={localeString('views.SwapDetails.swapId')}
                        value={swapData.id}
                    />

                    {isSubmarineSwap && (
                        <>
                            <KeyValue
                                keyValue={localeString(
                                    'views.SwapDetails.expectedAmount'
                                )}
                                value={
                                    <Amount
                                        sats={swapData?.expectedAmount}
                                        sensitive
                                        toggleable
                                    />
                                }
                            />
                            <KeyValue
                                keyValue={localeString('general.address')}
                                value={swapData.address}
                            />
                            {swapData?.txid && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.SendingOnChain.txid'
                                    )}
                                    value={swapData.txid}
                                    mempoolLink={() =>
                                        UrlUtils.goToBlockExplorerTXID(
                                            swapData?.txid,
                                            this.props.NodeInfoStore!.nodeInfo
                                                .isTestNet
                                        )
                                    }
                                    sensitive
                                />
                            )}
                        </>
                    )}
                    {isReverseSwap && (
                        <>
                            <KeyValue
                                keyValue={localeString('views.Invoice.title')}
                                value={swapData.invoice}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.SwapDetails.lockupAddress'
                                )}
                                value={swapData.lockupAddress}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.SwapDetails.onchainAmount'
                                )}
                                value={
                                    <Amount
                                        sats={swapData?.onchainAmount}
                                        sensitive
                                        toggleable
                                    />
                                }
                            />
                        </>
                    )}
                    <KeyValue
                        keyValue={localeString(
                            'views.SwapDetails.timeoutBlockHeight'
                        )}
                        infoModalText={localeString(
                            'views.SwapDetails.timeoutBlockHeight.explainer'
                        )}
                        value={`${numberWithCommas(
                            swapData.timeoutBlockHeight
                        )} ${this.timelockIndicator()}`}
                    />
                    {isSubmarineSwap && (
                        <KeyValue
                            keyValue={localeString(
                                'views.SwapDetails.claimPublicKey'
                            )}
                            value={swapData.claimPublicKey}
                        />
                    )}
                    {isReverseSwap && (
                        <KeyValue
                            keyValue={localeString(
                                'views.SwapDetails.refundPublicKey'
                            )}
                            value={swapData.refundPublicKey}
                        />
                    )}

                    {/* Render Swap Tree */}
                    {this.renderSwapTree(swapData.swapTree)}
                </ScrollView>
                {(updates === 'invoice.set' || updates === 'swap.created') && (
                    <Button
                        title={localeString('views.PaymentRequest.payInvoice')}
                        containerStyle={{
                            paddingVertical: 10
                        }}
                        onPress={() =>
                            handleAnything(
                                isSubmarineSwap
                                    ? swapData?.bip21
                                    : swapData?.invoice
                            ).then(([route, props]) => {
                                navigation.navigate(route, props);
                            })
                        }
                        secondary
                    />
                )}
                {showRefundButton && (
                    <Button
                        title={localeString('views.Swaps.refundSwap')}
                        containerStyle={{ paddingVertical: 10 }}
                        onPress={() =>
                            navigation.navigate('RefundSwap', { swapData })
                        }
                        secondary
                    />
                )}
            </Screen>
        );
    }
}
