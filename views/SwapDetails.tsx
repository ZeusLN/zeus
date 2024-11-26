import React from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';

import ReactNativeBlobUtil from 'react-native-blob-util';
import { inject, observer } from 'mobx-react';
import { crypto } from 'bitcoinjs-lib';
import bolt11 from 'bolt11';
import { randomBytes } from 'crypto';
import { Musig, SwapTreeSerializer, TaprootUtils } from 'boltz-core';
import zkpInit from '@nicolasflamel/secp256k1-zkp-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import Screen from '../components/Screen';
import Header from '../components/Header';
import KeyValue from '../components/KeyValue';
import Amount from '../components/Amount';
import Button from '../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import TransactionsStore from '../stores/TransactionsStore';

import QR from '../assets/images/SVG/QR.svg';

interface SwapDetailsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'SwapDetails',
        { swapData: any; keys: any; endpoint: any; invoice: any }
    >;
    TransactionsStore?: TransactionsStore;
}

interface SwapDetailsState {
    updates: any;
    error: any;
}

@inject('TransactionsStore')
@observer
export default class SwapDetails extends React.Component<
    SwapDetailsProps,
    SwapDetailsState
> {
    constructor(props: SwapDetailsProps) {
        super(props);
        this.state = {
            updates: null,
            error: null
        };
    }

    componentDidMount() {
        const { swapData } = this.props.route.params;
        this.subscribeToUpdatesWithPolling(swapData);
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

    subscribeToUpdatesWithPolling = async (
        createdResponse: any,
        pollingInterval: number = 2000
    ) => {
        const { keys, endpoint, invoice } = this.props.route.params;

        console.log('In polling function->', createdResponse);

        if (!createdResponse || !createdResponse.id) {
            console.error('Invalid response:', createdResponse);
            this.setState({ error: 'Invalid response received.' });
            return;
        }

        console.log('Starting polling for updates...');

        const pollForUpdates = async () => {
            try {
                const response = await fetch(
                    `${endpoint}/swap/${createdResponse.id}`,
                    {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                );
                const data = await response.json();

                this.setState({ updates: data.status });

                console.log('Update:', data);

                if (data.status === 'invoice.set') {
                    console.log('Waiting for onchain transaction...');
                } else if (data.status === 'transaction.claim.pending') {
                    console.log('Creating cooperative claim transaction...');

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
                    await this.createClaimTransaction(
                        claimTxDetails,
                        createdResponse,
                        keys,
                        endpoint
                    );
                } else if (data.status === 'transaction.claimed') {
                    console.log('Swap successful');
                    clearInterval(pollingTimer); // Stop polling when the swap is complete
                } else {
                    console.log('Unhandled status:', data.status);
                }
            } catch (error) {
                this.setState({ error: error });
                console.error('Error while polling for updates:', error);
            }
        };

        const pollingTimer = setInterval(pollForUpdates, pollingInterval);

        // Stop polling after 5 minutes to avoid infinite requests
        setTimeout(() => {
            clearInterval(pollingTimer);
            console.log('Stopped polling after timeout.');
        }, 15 * 60 * 1000); // 5 minutes
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
        try {
            console.log('inside validatePreimage func--->', invoice);
            let decoded: any;
            try {
                decoded = bolt11.decode(invoice);
            } catch (error) {
                console.log(error);
            }

            let paymentHash: any;
            paymentHash = decoded.tags.find(
                (tag: any) => tag.tagName === 'payment_hash'
            );
            console.log('paymenthash', paymentHash);

            invoicePreimageHash = Buffer.from(paymentHash!.data || '', 'hex');

            console.log('final invoicePreimageHash ', invoicePreimageHash);

            // invoicePreimageHash = Buffer.from(
            //     bolt11
            //         .decode(invoice)
            //         .tags.find((tag) => tag.tagName === 'payment_hash')!
            //         .data as string,
            //     'hex'
            // );
        } catch (error) {
            console.log('block 1', error);
        }
        let resp: any;
        try {
            resp = crypto
                .sha256(Buffer.from(preimage, 'hex'))
                .equals(invoicePreimageHash);
        } catch (error) {
            console.log('block 2', error);
        }

        return resp;
    };

    /**
     * Create and send a claim transaction using Musig and TaprootUtils.
     */
    createClaimTransaction = async (
        claimTxDetails: any,
        createdResponse: any,
        keys: any,
        endpoint: any
    ) => {
        const boltzPublicKey = Buffer.from(
            createdResponse.claimPublicKey,
            'hex'
        );

        // Initialize Musig

        let musig: any;
        try {
            musig = new Musig(await zkpInit(), keys, randomBytes(32), [
                boltzPublicKey,
                keys.publicKey
            ]);
        } catch (error) {
            console.log(error);
        }
        // Tweak Musig
        TaprootUtils.tweakMusig(
            musig,
            SwapTreeSerializer.deserializeSwapTree(createdResponse.swapTree)
                .tree
        );

        // Aggregate nonces and initialize session
        musig.aggregateNonces([
            [boltzPublicKey, Buffer.from(claimTxDetails.pubNonce, 'hex')]
        ]);
        musig.initializeSession(
            Buffer.from(claimTxDetails.transactionHash, 'hex')
        );

        // Post claim transaction
        await ReactNativeBlobUtil.fetch(
            'POST',
            `${endpoint}/swap/submarine/${createdResponse.id}/claim`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({
                pubNonce: Buffer.from(musig.getPublicNonce()).toString('hex'),
                partialSignature: Buffer.from(musig.signPartial()).toString(
                    'hex'
                )
            })
        );

        console.log('Claim transaction submitted successfully.');
    };

    render() {
        const { navigation, TransactionsStore } = this.props;

        const { updates, error } = this.state;
        const swapData = this.props.route.params?.swapData ?? '';

        const QRButton = () => {
            if (!swapData?.bip21) {
                return null;
            }

            return (
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('QR', {
                            value: swapData?.bip21
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
                    rightComponent={<QRButton />}
                    navigation={navigation}
                />
                <ScrollView style={{ marginHorizontal: 20 }}>
                    {updates && (
                        <KeyValue
                            keyValue={localeString('views.Channel.status')}
                            value={updates}
                            color={
                                updates === 'transaction.claimed'
                                    ? 'green'
                                    : 'orange'
                            }
                        />
                    )}
                    <KeyValue
                        keyValue={localeString('views.SwapDetails.bip21')}
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
                        color={swapData.acceptZeroConf ? 'green' : '#808000'}
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
                    <KeyValue
                        keyValue={localeString('views.SwapDetails.swapId')}
                        value={swapData.id}
                    />
                    <KeyValue
                        keyValue={localeString('general.address')}
                        value={swapData.address}
                    />
                    {/* Render Swap Tree */}
                    {this.renderSwapTree(swapData.swapTree)}
                    <KeyValue
                        keyValue={localeString(
                            'views.SwapDetails.timeoutBlockHeight'
                        )}
                        value={swapData.timeoutBlockHeight}
                    />
                    <KeyValue
                        keyValue={localeString(
                            'views.SwapDetails.claimPublicKey'
                        )}
                        value={swapData.claimPublicKey}
                    />

                    {error && (
                        <KeyValue
                            keyValue={localeString('general.error')}
                            value={error?.message || String(error)}
                            color="red"
                        />
                    )}
                </ScrollView>
                <Button
                    title={localeString('views.PaymentRequest.payInvoice')}
                    containerStyle={{
                        paddingVertical: 10
                    }}
                    onPress={() => {
                        console.log(swapData?.bip21);
                        // TransactionsStore?.sendCoins(swapData?.bip21);
                        // navigation.navigate('SendingOnChain');
                    }}
                    secondary
                />
            </Screen>
        );
    }
}
