import * as React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import BigNumber from 'bignumber.js';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { crypto } from 'bitcoinjs-lib';
import bolt11 from 'bolt11';
import { randomBytes } from 'crypto';
import { ECPairFactory } from 'ecpair';
import zkpInit from '@nicolasflamel/secp256k1-zkp-react';
import ecc from '@bitcoinerlab/secp256k1';
import { Musig, SwapTreeSerializer, TaprootUtils } from 'boltz-core';

import SwapStore from '../stores/SwapStore';
import UnitsStore from '../stores/UnitsStore';
import { SATS_PER_BTC } from '../utils/UnitsUtils';

import Amount from '../components/Amount';
import Button from '../components/Button';
import Header from '../components/Header';
import { Row } from '../components/layout/Row';
import Screen from '../components/Screen';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import AmountInput from '../components/AmountInput';
import LoadingIndicator from '../components/LoadingIndicator';
import {
    ErrorMessage,
    SuccessMessage
} from '../components/SuccessErrorMessage';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ArrowDown from '../assets/images/SVG/Arrow_down.svg';
import OnChainSvg from '../assets/images/SVG/DynamicSVG/OnChainSvg';
import QR from '../assets/images/SVG/QR.svg';
import LightningSvg from '../assets/images/SVG/DynamicSVG/LightningSvg';

interface SwapPaneProps {
    navigation: StackNavigationProp<any, any>;
    SwapStore: SwapStore;
    UnitsStore: UnitsStore;
}

interface SwapPaneState {
    reverse: boolean;
    serviceFeeSats: number | any;
    inputSats: number | any;
    outputSats: number | any;
    invoice: string;
    apiError: any;
    apiUpdates: any;
    response: any;
}

@inject('SwapStore', 'UnitsStore')
@observer
export default class SwapPane extends React.PureComponent<
    SwapPaneProps,
    SwapPaneState
> {
    state = {
        reverse: false,
        serviceFeeSats: 0,
        inputSats: 0,
        outputSats: 0,
        invoice: '',
        apiUpdates: '',
        apiError: null,
        response: null
    };

    async UNSAFE_componentWillMount() {
        this.props.SwapStore.getSwapFees();
    }

    render() {
        const { SwapStore, UnitsStore, navigation } = this.props;
        const {
            reverse,
            serviceFeeSats,
            inputSats,
            outputSats,
            apiError,
            apiUpdates,
            invoice
        } = this.state;
        const { subInfo, reverseInfo, loading } = SwapStore;
        const info: any = reverse ? reverseInfo : subInfo;
        const { units } = UnitsStore;

        const serviceFeePct = info?.fees?.percentage || 0;
        const networkFee = reverse
            ? new BigNumber(info?.fees?.minerFees?.claim || 0).plus(
                  info?.fees?.minerFees?.lockup || 0
              )
            : info?.fees?.minerFees || 0;

        const bigCeil = (big: BigNumber): BigNumber => {
            return big.integerValue(BigNumber.ROUND_CEIL);
        };

        const bigFloor = (big: BigNumber): BigNumber => {
            return big.integerValue(BigNumber.ROUND_FLOOR);
        };

        const keys: any = ECPairFactory(ecc).makeRandom();

        const endpoint = 'https://api.testnet.boltz.exchange/v2';

        const subscribeToUpdatesWithPolling = async (
            createdResponse: any,
            pollingInterval: number = 2000
        ) => {
            console.log('In polling function->', createdResponse);

            if (!createdResponse || !createdResponse.id) {
                console.error('Invalid response:', createdResponse);
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

                    this.setState({ apiUpdates: data.status });

                    console.log('Update:', data);

                    if (data.status === 'invoice.set') {
                        console.log('Waiting for onchain transaction...');
                    } else if (data.status === 'transaction.claim.pending') {
                        console.log(
                            'Creating cooperative claim transaction...'
                        );

                        const claimTxDetails = await fetchClaimDetails(
                            createdResponse.id,
                            endpoint
                        );
                        console.log('Fetched claim details:', claimTxDetails);

                        const isValid = validatePreimage(
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
                        await createClaimTransaction(
                            claimTxDetails,
                            createdResponse,
                            keys
                        );
                    } else if (data.status === 'transaction.claimed') {
                        console.log('Swap successful');
                        clearInterval(pollingTimer); // Stop polling when the swap is complete
                    } else {
                        console.log('Unhandled status:', data.status);
                    }
                } catch (error) {
                    this.setState({ apiError: error });
                    console.error('Error while polling for updates:', error);
                }
            };

            // Start polling
            const pollingTimer = setInterval(pollForUpdates, pollingInterval);

            // Stop polling after 5 minutes to avoid infinite requests
            setTimeout(() => {
                clearInterval(pollingTimer);
                console.log('Stopped polling after timeout.');
            }, 15 * 60 * 1000); // 5 minutes
        };

        /**
         * Fetch claim details from the Boltz endpoint.
         */
        const fetchClaimDetails = async (swapId: string, endpoint: string) => {
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
        const validatePreimage = (
            preimage: string,
            invoice: string
        ): boolean => {
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

                invoicePreimageHash = Buffer.from(
                    paymentHash!.data || '',
                    'hex'
                );

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
        const createClaimTransaction = async (
            claimTxDetails: any,
            createdResponse: any,
            keys: any
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
                    pubNonce: Buffer.from(musig.getPublicNonce()).toString(
                        'hex'
                    ),
                    partialSignature: Buffer.from(musig.signPartial()).toString(
                        'hex'
                    )
                })
            );

            console.log('Claim transaction submitted successfully.');
        };

        const createSubmarineSwap = async (invoice: any) => {
            try {
                console.log('Creating submarine swap...');
                const response = await ReactNativeBlobUtil.fetch(
                    'POST',
                    `${endpoint}/swap/submarine`,
                    {
                        'Content-Type': 'application/json'
                    },
                    JSON.stringify({
                        invoice,
                        to: 'BTC',
                        from: 'BTC',
                        refundPublicKey: Buffer.from(keys.publicKey).toString(
                            'hex'
                        )
                    })
                );

                const responseData = JSON.parse(response.data);
                console.log('Parsed Response Data:', responseData);
                this.setState({
                    response: responseData
                });
                if (responseData && responseData?.error) {
                    this.setState({
                        apiError: responseData?.error
                    });
                    return;
                }

                subscribeToUpdatesWithPolling(responseData, 1000);
            } catch (error) {
                console.error('Error creating Submarine Swap:', error);
                throw error;
            }
        };

        const calculateReceiveAmount = (
            sendAmount: BigNumber,
            serviceFee: number,
            minerFee: number
        ): BigNumber => {
            const receiveAmount = reverse
                ? sendAmount
                      .minus(bigCeil(sendAmount.times(serviceFee).div(100)))
                      .minus(minerFee)
                : sendAmount
                      .minus(minerFee)
                      .div(
                          new BigNumber(1).plus(
                              new BigNumber(serviceFee).div(100)
                          )
                      );
            return BigNumber.maximum(bigFloor(receiveAmount), 0);
        };

        const calculateServiceFeeOnSend = (
            sendAmount: BigNumber,
            serviceFee: number,
            minerFee: number
        ): BigNumber => {
            if (sendAmount.isNaN()) {
                return new BigNumber(0);
            }

            let fee: BigNumber;

            if (reverse) {
                fee = bigCeil(sendAmount.times(serviceFee).div(100));
            } else {
                fee = sendAmount
                    .minus(
                        calculateReceiveAmount(sendAmount, serviceFee, minerFee)
                    )
                    .minus(minerFee);

                if (sendAmount.toNumber() < minerFee) {
                    fee = new BigNumber(0);
                }
            }

            return bigCeil(fee);
        };

        const calculateSendAmount = (
            receiveAmount: BigNumber,
            serviceFee: number,
            minerFee: number
        ): BigNumber => {
            return reverse
                ? bigCeil(
                      receiveAmount
                          .plus(minerFee)
                          .div(
                              new BigNumber(1).minus(
                                  new BigNumber(serviceFee).div(100)
                              )
                          )
                  )
                : bigFloor(
                      receiveAmount
                          .plus(
                              bigCeil(
                                  receiveAmount.times(
                                      new BigNumber(serviceFee).div(100)
                                  )
                              )
                          )
                          .plus(minerFee)
                  );
        };

        const calculateLimit = (limit: number): number => {
            return !reverse
                ? calculateSendAmount(
                      new BigNumber(limit),
                      serviceFeePct,
                      networkFee
                  ).toNumber()
                : limit;
        };

        const min = calculateLimit(info?.limits?.minimal || 0);
        const max = calculateLimit(info?.limits?.maximal || 0);

        const errorInput =
            (inputSats !== 0 && inputSats < min) || inputSats > max;
        const errorOutput = outputSats < 0;
        const error = errorInput || errorOutput;

        const QRButton = () => {
            if (!this.state.response?.bip21) {
                return null;
            }

            return (
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('QR', {
                            value: this.state.response?.bip21
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
                        text: localeString('views.Swaps.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={<QRButton />}
                    navigation={navigation}
                />
                <View style={{ flex: 1, margin: 10 }}>
                    {loading && <LoadingIndicator />}
                    {!loading && (
                        <>
                            {apiError && (
                                <ErrorMessage
                                    message={
                                        apiError?.message || String(apiError)
                                    }
                                />
                            )}

                            {apiUpdates && (
                                <SuccessMessage message={apiUpdates} />
                            )}

                            <View style={{ alignItems: 'center' }}>
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 20,
                                        marginBottom: 20
                                    }}
                                >
                                    {localeString('views.Swaps.create')}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ flex: 1 }}>
                                    <Row
                                        style={{
                                            position: 'absolute',
                                            zIndex: 1
                                        }}
                                    >
                                        <AmountInput
                                            prefix={
                                                <View
                                                    style={{ marginLeft: -10 }}
                                                >
                                                    {reverse ? (
                                                        <LightningSvg
                                                            width={60}
                                                        />
                                                    ) : (
                                                        <OnChainSvg
                                                            width={60}
                                                        />
                                                    )}
                                                </View>
                                            }
                                            onAmountChange={(
                                                _,
                                                satAmount: string | number
                                            ) => {
                                                if (
                                                    !satAmount ||
                                                    satAmount === '0'
                                                ) {
                                                    this.setState({
                                                        serviceFeeSats: 0,
                                                        outputSats: 0
                                                    });
                                                }

                                                const satAmountNew =
                                                    new BigNumber(
                                                        satAmount || 0
                                                    );

                                                const outputSats =
                                                    calculateReceiveAmount(
                                                        satAmountNew,
                                                        serviceFeePct,
                                                        networkFee
                                                    );

                                                this.setState({
                                                    serviceFeeSats:
                                                        calculateServiceFeeOnSend(
                                                            satAmountNew,
                                                            serviceFeePct,
                                                            networkFee
                                                        ),
                                                    inputSats:
                                                        Number(satAmount),
                                                    outputSats
                                                });
                                            }}
                                            sats={
                                                inputSats
                                                    ? inputSats.toString()
                                                    : ''
                                            }
                                            hideConversion
                                            error={errorInput}
                                        />
                                    </Row>
                                    <TouchableOpacity
                                        style={{
                                            alignSelf: 'center',
                                            position: 'absolute',
                                            zIndex: 100,
                                            top: 50
                                        }}
                                        onPress={() => {
                                            this.setState({
                                                reverse: !reverse,
                                                inputSats: 0,
                                                outputSats: 0,
                                                serviceFeeSats: 0
                                            });
                                        }}
                                    >
                                        <View
                                            style={{
                                                backgroundColor:
                                                    themeColor('background'),
                                                borderRadius: 30,
                                                padding: 10
                                            }}
                                        >
                                            <ArrowDown
                                                fill={themeColor('text')}
                                                height="30"
                                                width="30"
                                            />
                                        </View>
                                    </TouchableOpacity>
                                    <View style={{ zIndex: 2 }}>
                                        <Row
                                            style={{
                                                position: 'absolute',
                                                zIndex: 1,
                                                top: 70
                                            }}
                                        >
                                            <AmountInput
                                                prefix={
                                                    <View
                                                        style={{
                                                            marginLeft: -10
                                                        }}
                                                    >
                                                        {reverse ? (
                                                            <OnChainSvg
                                                                width={60}
                                                            />
                                                        ) : (
                                                            <LightningSvg
                                                                width={60}
                                                            />
                                                        )}
                                                    </View>
                                                }
                                                onAmountChange={(
                                                    _,
                                                    satAmount: string | number
                                                ) => {
                                                    if (
                                                        !satAmount ||
                                                        satAmount === '0'
                                                    ) {
                                                        this.setState({
                                                            serviceFeeSats: 0,
                                                            inputSats: 0
                                                        });
                                                    }

                                                    const satAmountNew =
                                                        new BigNumber(
                                                            satAmount || 0
                                                        );

                                                    let input: any;
                                                    if (
                                                        satAmountNew.isEqualTo(
                                                            0
                                                        )
                                                    ) {
                                                        input = 0;
                                                    } else
                                                        input =
                                                            calculateSendAmount(
                                                                satAmountNew,
                                                                serviceFeePct,
                                                                networkFee
                                                            );

                                                    const serviceFeeSats =
                                                        reverse && input
                                                            ? input
                                                                  .times(
                                                                      serviceFeePct
                                                                  )
                                                                  .div(100)
                                                            : satAmountNew
                                                                  .times(
                                                                      serviceFeePct
                                                                  )
                                                                  .div(100);

                                                    this.setState({
                                                        serviceFeeSats:
                                                            bigCeil(
                                                                serviceFeeSats
                                                            ),
                                                        inputSats: input,
                                                        outputSats:
                                                            Number(satAmount)
                                                    });
                                                }}
                                                hideConversion
                                                sats={
                                                    outputSats
                                                        ? outputSats.toString()
                                                        : ''
                                                }
                                                error={errorOutput}
                                            />
                                        </Row>
                                    </View>
                                    <Row justify="space-between">
                                        <View style={{ top: 165 }}>
                                            <Row>
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    Network fee:{' '}
                                                </Text>
                                                <Amount sats={networkFee} />
                                            </Row>
                                            <Row>
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    Service fee:{' '}
                                                </Text>
                                                <Amount sats={serviceFeeSats} />
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    {' '}
                                                    ({serviceFeePct}%)
                                                </Text>
                                            </Row>
                                        </View>
                                        <View style={{ top: 165 }}>
                                            <Row>
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    Min:{' '}
                                                </Text>
                                                <Amount sats={min} />
                                            </Row>
                                            <Row>
                                                <Text
                                                    style={{
                                                        fontFamily:
                                                            'PPNeueMontreal-Book'
                                                    }}
                                                >
                                                    Max:{' '}
                                                </Text>
                                                <Amount sats={max} />
                                            </Row>
                                        </View>
                                    </Row>
                                </View>
                            </View>

                            <View>
                                <Button
                                    onPress={() => {
                                        console.log(
                                            outputSats,
                                            outputSats.toString()
                                        );
                                        navigation.navigate('Receive', {
                                            amount:
                                                units === 'sats'
                                                    ? outputSats
                                                    : units === 'BTC'
                                                    ? new BigNumber(outputSats)
                                                          .div(SATS_PER_BTC)
                                                          .toFixed(8)
                                                    : '',
                                            selectedIndex: reverse ? 2 : 1,
                                            autoGenerate: true
                                        });
                                    }}
                                    title={
                                        !reverse
                                            ? 'Generate Invoice'
                                            : 'Create Onchain Address'
                                    }
                                />
                            </View>
                            <TextInput
                                onChangeText={(text: string) => {
                                    this.setState({
                                        invoice: text,
                                        apiError: '',
                                        apiUpdates: ''
                                    });
                                }}
                                placeholder={
                                    reverse
                                        ? 'Enter onchain address'
                                        : 'Enter invoice'
                                }
                                style={{
                                    marginHorizontal: 20,
                                    marginVertical: 10
                                }}
                                value={invoice}
                            />
                            <View>
                                <Button
                                    title="Create Atomic Swap"
                                    onPress={() => {
                                        createSubmarineSwap(invoice);
                                    }}
                                    secondary
                                    containerStyle={{ marginTop: 10 }}
                                    disabled={invoice === ''}
                                />
                            </View>
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}
