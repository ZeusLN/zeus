import React from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';

import ReactNativeBlobUtil from 'react-native-blob-util';
import { inject, observer } from 'mobx-react';
import { crypto } from 'bitcoinjs-lib';
import bolt11 from 'bolt11';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import EncryptedStorage from 'react-native-encrypted-storage';

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

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import NodeInfoStore from '../../stores/NodeInfoStore';
import SwapStore from '../../stores/SwapStore';

import QR from '../../assets/images/SVG/QR.svg';

interface SwapDetailsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'SwapDetails',
        {
            swapData: any;
            keys: any;
            endpoint: string;
            invoice: string;
            fee: string;
        }
    >;
    NodeInfoStore?: NodeInfoStore;
    SwapStore?: SwapStore;
}

interface SwapDetailsState {
    updates: string | null;
    error: string | { message?: string } | null;
    loading: boolean;
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
            error: null,
            loading: false
        };
    }

    componentDidMount() {
        const { swapData } = this.props.route.params;

        console.log(swapData);

        if (!swapData) {
            console.error('No swap data provided.');
            return;
        }

        const isSubmarineSwap = Boolean(swapData.bip21);

        if (isSubmarineSwap) {
            if (swapData?.status === 'invoice.failedToPay') {
                this.setState({ updates: 'invoice.failedToPay' });
                return;
            }
            if (swapData?.status === 'transaction.refunded') {
                this.setState({ updates: 'transaction.refunded' });
                return;
            }
            if (swapData?.status === 'transaction.claimed') {
                this.setState({ updates: 'transaction.claimed' });
                return;
            }
            this.getSwapUpdates(swapData, isSubmarineSwap);
        } else {
            this.getReverseSwapUpdates(swapData, isSubmarineSwap);
        }
    }

    renderSwapTree = (swapTree: any) => {
        if (!swapTree) return null;

        return (
            <View>
                <KeyValue keyValue="Swap Tree" />
                {Object.entries(swapTree).map(([key, value]: [string, any]) => (
                    <View key={key}>
                        <KeyValue keyValue={key} />
                        {typeof value === 'object' ? (
                            Object.entries(value).map(
                                ([nestedKey, nestedValue]: [string, any]) => (
                                    <KeyValue
                                        key={nestedKey}
                                        keyValue={nestedKey}
                                        value={nestedValue}
                                    />
                                )
                            )
                        ) : (
                            <KeyValue key={key} keyValue={key} value={value} />
                        )}
                    </View>
                ))}
            </View>
        );
    };

    getSwapUpdates = async (createdResponse: any, isSubmarineSwap: boolean) => {
        const { keys, endpoint, invoice } = this.props.route.params;

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
                        loading: false
                    });
                    webSocket.close();
                    return;
                }

                this.setState({
                    error: data.error
                });
                webSocket.close();
                return;
            }

            // Update the status in the component state
            this.setState({ updates: data.status, loading: false });

            // Update the status in Encrypted Storage
            await this.updateSwapStatusInStorage(
                createdResponse.id,
                data.status,
                isSubmarineSwap
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
                case 'transaction.claimed':
                case 'invoice.failedToPay':
                case 'swap.expired':
                    webSocket.close();
                    data?.failureReason &&
                        this.setState({ error: data?.failureReason });
                    break;
                default:
                    console.log('Unhandled status:', data.status);
            }
        };

        webSocket.onerror = (error) => {
            this.setState({
                error: error.message || error || 'An unknown error occurred'
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
                        loading: false
                    });
                    webSocket.close();
                    return;
                }

                this.setState({
                    error: data.error
                });
                webSocket.close();
                return;
            }

            // Update the status in the component state
            this.setState({ updates: data.status, loading: false });

            // Update the status in Encrypted Storage
            await this.updateSwapStatusInStorage(
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
                        this.setState({ error: data?.failureReason });
                    break;

                case 'invoice.settled':
                    console.log('Swap successful');
                    webSocket.close();
                    break;

                default:
                    console.log('Unhandled status:', data.status);
                    break;
            }
        };

        webSocket.onerror = (error) => {
            this.setState({
                error: error.message || error || 'An unknown error occurred'
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

    updateSwapStatusInStorage = async (
        swapId: string,
        status: string,
        isSubmarineSwap: boolean
    ) => {
        try {
            let storedSwaps: any;
            if (isSubmarineSwap) {
                storedSwaps = await EncryptedStorage.getItem('swaps');
            } else {
                storedSwaps = await EncryptedStorage.getItem('reverse-swaps');
            }
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            const updatedSwaps = swaps.map((swap: any) =>
                swap.id === swapId ? { ...swap, status } : swap
            );

            await EncryptedStorage.setItem(
                isSubmarineSwap ? 'swaps' : 'reverse-swaps',
                JSON.stringify(updatedSwaps)
            );
            console.log(
                `Updated ${
                    isSubmarineSwap ? `swap ` : `reverse swap `
                }status for swap ID ${swapId} to "${status}"`
            );
        } catch (error) {
            console.error('Error updating swap status in storage:', error);
        }
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

            try {
                await createReverseClaimTransaction({
                    endpoint,
                    swapId: createdResponse.id,
                    claimLeaf: createdResponse.swapTree.claimLeaf.output,
                    refundLeaf: createdResponse.swapTree.refundLeaf.output,
                    privateKey: privateKeyHex,
                    servicePubKey: createdResponse.claimPublicKey,
                    preimageHex: preimage.toString('hex'),
                    transactionHex,
                    lockupAddress,
                    destinationAddress,
                    feeRate: Number(fee),
                    isTestnet: this.props.NodeInfoStore!.nodeInfo.isTestNet
                });

                console.log(
                    'Reverse claim transaction submitted successfully.'
                );
                return true;
            } catch (error) {
                console.log('Error submitting reverse claim tx', error);
                return false;
            }
        } catch (e) {
            console.log('Error creating reverse claim tx ', e);
            return false;
        }
    };

    render() {
        const { navigation, SwapStore } = this.props;

        const { updates, error } = this.state;
        const swapData = this.props.route.params?.swapData ?? '';

        const isSubmarineSwap = !!swapData.bip21;
        const isReverseSwap = !!swapData.lockupAddress;

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
                        updates === 'invoice.set' || isReverseSwap ? (
                            <QRButton />
                        ) : (
                            <></>
                        )
                    }
                    navigation={navigation}
                />
                <ScrollView style={{ marginHorizontal: 20 }}>
                    {this.state.loading && <LoadingIndicator />}
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
                    {isSubmarineSwap && (
                        <>
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
                            <KeyValue
                                keyValue={localeString(
                                    'views.SwapDetails.bip21'
                                )}
                                value={swapData.bip21}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.SwapDetails.acceptZerpConf'
                                )}
                                value={
                                    swapData.acceptZeroConf
                                        ? localeString('general.true')
                                        : localeString('general.false')
                                }
                                color={
                                    swapData.acceptZeroConf
                                        ? 'green'
                                        : '#808000'
                                }
                            />
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
                        </>
                    )}
                    {isReverseSwap && (
                        <>
                            <KeyValue
                                keyValue="Invoice"
                                value={swapData.invoice}
                            />
                            <KeyValue
                                keyValue="Lockup address"
                                value={swapData.lockupAddress}
                            />
                            <KeyValue
                                keyValue="Onchain amount"
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
                        keyValue={localeString('views.SwapDetails.swapId')}
                        value={swapData.id}
                    />
                    {isSubmarineSwap && (
                        <KeyValue
                            keyValue={localeString('general.address')}
                            value={swapData.address}
                        />
                    )}

                    {/* Render Swap Tree */}
                    {this.renderSwapTree(swapData.swapTree)}
                    <KeyValue
                        keyValue={localeString(
                            'views.SwapDetails.timeoutBlockHeight'
                        )}
                        value={swapData.timeoutBlockHeight}
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
                            keyValue="Refund public key"
                            value={swapData.refundPublicKey}
                        />
                    )}
                </ScrollView>
                {(updates === 'invoice.set' || updates === 'swap.created') && (
                    <Button
                        title={localeString('views.PaymentRequest.payInvoice')}
                        containerStyle={{
                            paddingVertical: 10
                        }}
                        onPress={() => {
                            navigation.navigate('Send', {
                                destination: isSubmarineSwap
                                    ? swapData?.bip21
                                    : swapData?.invoice,
                                transactionType: isSubmarineSwap && 'On-chain'
                            });
                        }}
                        secondary
                    />
                )}
                {(updates === 'invoice.failedToPay' ||
                    updates === 'transaction.lockupFailed') && (
                    <Button
                        title={localeString('views.Swaps.refundSwap')}
                        containerStyle={{
                            paddingVertical: 10
                        }}
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
