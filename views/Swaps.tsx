import * as React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import BigNumber from 'bignumber.js';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';
import { crypto, initEccLib } from 'bitcoinjs-lib';

import { randomBytes } from 'crypto';

import EncryptedStorage from 'react-native-encrypted-storage';

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
import { SATS_PER_BTC, numberWithCommas } from '../utils/UnitsUtils';
import AddressUtils from '../utils/AddressUtils';

import SwapStore, { HOST } from '../stores/SwapStore';
import UnitsStore from '../stores/UnitsStore';
import InvoicesStore from '../stores/InvoicesStore';

import ArrowDown from '../assets/images/SVG/Arrow_down.svg';
import OnChainSvg from '../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../assets/images/SVG/DynamicSVG/LightningSvg';
import OrderList from '../assets/images/SVG/order-list.svg';

interface SwapPaneProps {
    navigation: StackNavigationProp<any, any>;
    SwapStore: SwapStore;
    UnitsStore: UnitsStore;
    InvoicesStore: InvoicesStore;
}

interface SwapPaneState {
    reverse: boolean;
    serviceFeeSats: number | any;
    inputSats: number | any;
    outputSats: number | any;
    invoice: string;
    isValid: boolean;
    apiError: any;
    apiUpdates: any;
    response: any;
    fetchingInvoice: boolean;
}

@inject('SwapStore', 'UnitsStore', 'InvoicesStore')
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
        isValid: false,
        apiUpdates: '',
        apiError: null,
        response: null,
        fetchingInvoice: false
    };

    async UNSAFE_componentWillMount() {
        this.props.SwapStore.getSwapFees();
    }

    render() {
        const { SwapStore, UnitsStore, navigation, InvoicesStore } = this.props;
        const {
            reverse,
            serviceFeeSats,
            inputSats,
            outputSats,
            apiError,
            apiUpdates,
            invoice,
            isValid,
            fetchingInvoice
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

        const SwapsPaneBtn = () => (
            <TouchableOpacity
                style={{ marginTop: -10 }}
                onPress={() => {
                    navigation.navigate('SwapsPane');
                    // EncryptedStorage.setItem(
                    //     'reverse-swaps',
                    //     JSON.stringify([])
                    // );
                }}
                accessibilityLabel={localeString('general.add')}
            >
                <OrderList
                    fill={themeColor('text')}
                    width="40"
                    height="40"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const createSubmarineSwap = async (invoice: any) => {
            const { SwapStore } = this.props;
            try {
                console.log('Creating submarine swap...');

                const keys: any = ECPairFactory(ecc).makeRandom();

                const response = await ReactNativeBlobUtil.fetch(
                    'POST',
                    `${HOST}/swap/submarine`,
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

                const responseData = JSON.parse(response.data); // Parse the response
                console.log('Parsed Response Data:', responseData);

                // Check for errors in the response
                if (responseData?.error) {
                    SwapStore.loading = false;
                    this.setState({ apiError: responseData.error });
                    console.error('Error in API response:', responseData.error);
                    return;
                }

                // Add the creation date to the response
                const createdAt = new Date().toISOString();
                responseData.createdAt = createdAt;

                // Add the swap type
                responseData.type = 'Submarine';

                await saveSwapToStorage(responseData, keys, invoice);

                // No errors, proceed with setting the response and navigating
                this.setState({ response: responseData }, () => {
                    SwapStore.loading = false;
                    console.log('Navigating to SwapDetails...');
                    navigation.navigate('SwapDetails', {
                        swapData: responseData,
                        keys,
                        endpoint: HOST,
                        invoice
                    });
                });
            } catch (error: any) {
                // Handle errors during API call
                this.setState({
                    apiError: error.message || 'An unknown error occurred',
                    invoice: ''
                });
                console.error('Error creating Submarine Swap:', error);
            }
        };

        const createReverseSwap = async (destinationAddress: string) => {
            const { SwapStore } = this.props;

            try {
                initEccLib(ecc);

                console.log('Creating reverse swap...');

                const preimage = randomBytes(32);
                const keys: any = ECPairFactory(ecc).makeRandom();

                // Creating a reverse swap
                const data = JSON.stringify({
                    invoiceAmount: Number(this.state.outputSats),
                    to: 'BTC',
                    from: 'BTC',
                    claimPublicKey: Buffer.from(keys.publicKey).toString('hex'),
                    preimageHash: crypto.sha256(preimage).toString('hex')
                });

                console.log('Data before sending to API:', data);

                const response = await ReactNativeBlobUtil.fetch(
                    'POST',
                    `${HOST}/swap/reverse`,
                    {
                        'Content-Type': 'application/json'
                    },
                    data
                );

                const responseData = JSON.parse(response.data); // Parse the response
                console.log('Created reverse swap:', responseData);

                // Handle API errors
                if (responseData?.error) {
                    SwapStore.loading = false;
                    this.setState({ apiError: responseData.error });
                    console.error('Error in API response:', responseData.error);
                    return;
                }

                // Add the creation date
                const createdAt = new Date().toISOString();
                responseData.createdAt = createdAt;

                // Add the swap type
                responseData.type = 'Reverse';

                // Step 3: Save to storage
                await saveReverseSwaps(responseData, keys, destinationAddress);

                // Step 4: Navigate to SwapDetails view
                this.setState({ response: responseData }, () => {
                    SwapStore.loading = false;
                    console.log('Navigating to SwapDetails...');
                    navigation.navigate('SwapDetails', {
                        swapData: responseData,
                        keys,
                        endpoint: HOST,
                        invoice: destinationAddress
                    });
                });
            } catch (error: any) {
                console.error('Error creating reverse swap:', error);
                this.setState({
                    apiError: error.message || 'An unknown error occurred'
                });
            }
        };

        const saveReverseSwaps = async (
            newSwap: any,
            keys: any,
            destinationAddress: string
        ) => {
            try {
                // Retrieve existing swaps
                const storedSwaps = await EncryptedStorage.getItem(
                    'reverse-swaps'
                );
                const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

                // Add new properties to the swap
                const enrichedSwap = {
                    ...newSwap,
                    keys,
                    destinationAddress
                };

                // Add the new swap to the beginning of the array
                swaps.unshift(enrichedSwap);

                // Save the updated swaps array back to encrypted storage
                await EncryptedStorage.setItem(
                    'reverse-swaps',
                    JSON.stringify(swaps)
                );

                console.log(
                    'Reverse swap saved successfully to Encrypted Storage.'
                );
            } catch (error: any) {
                console.error('Error saving reverse swap to storage:', error);
                throw error;
            }
        };

        const saveSwapToStorage = async (
            newSwap: any,
            keys: any,
            invoice: any
        ) => {
            try {
                // Retrieve existing swaps
                const storedSwaps = await EncryptedStorage.getItem('swaps');
                const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

                // Adding the new properties to the swap
                const enrichedSwap = {
                    ...newSwap,
                    keys,
                    invoice
                };

                // Add the enriched swap to the beginning of array
                swaps.unshift(enrichedSwap);

                // Save the updated swaps array back to Encrypted Storage
                await EncryptedStorage.setItem('swaps', JSON.stringify(swaps));
                console.log('Swap saved successfully to Encrypted Storage.');
            } catch (error: any) {
                console.error('Error saving swap to storage:', error);
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
        const errorMsg = errorInput || errorOutput;

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
                    rightComponent={<SwapsPaneBtn />}
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
                                <Row
                                    style={{
                                        position: 'absolute',
                                        zIndex: 1
                                    }}
                                >
                                    <AmountInput
                                        prefix={
                                            <View style={{ marginLeft: -10 }}>
                                                {reverse ? (
                                                    <LightningSvg width={60} />
                                                ) : (
                                                    <OnChainSvg width={60} />
                                                )}
                                            </View>
                                        }
                                        onAmountChange={(
                                            _,
                                            satAmount: string | number
                                        ) => {
                                            this.setState({ apiError: '' });

                                            // remove commas
                                            const sanitizedSatAmount =
                                                units !== 'BTC'
                                                    ? String(satAmount)
                                                          .replace(/,/g, '')
                                                          .trim()
                                                    : satAmount;
                                            if (
                                                !sanitizedSatAmount ||
                                                sanitizedSatAmount === '0'
                                            ) {
                                                this.setState({
                                                    serviceFeeSats: 0,
                                                    outputSats: 0
                                                });
                                            }

                                            const satAmountNew = new BigNumber(
                                                sanitizedSatAmount || 0
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
                                                    Number(sanitizedSatAmount),
                                                outputSats
                                            });
                                        }}
                                        sats={
                                            inputSats
                                                ? units !== 'BTC'
                                                    ? numberWithCommas(
                                                          inputSats.toString()
                                                      )
                                                    : inputSats.toString()
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
                                            serviceFeeSats: 0,
                                            invoice: ''
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
                                                    style={{ marginLeft: -10 }}
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
                                                this.setState({ apiError: '' });

                                                // remove commas
                                                const sanitizedSatAmount =
                                                    units !== 'BTC'
                                                        ? String(satAmount)
                                                              .replace(/,/g, '')
                                                              .trim()
                                                        : satAmount;
                                                if (
                                                    !sanitizedSatAmount ||
                                                    sanitizedSatAmount === '0'
                                                ) {
                                                    this.setState({
                                                        serviceFeeSats: 0,
                                                        inputSats: 0
                                                    });
                                                }

                                                const satAmountNew =
                                                    new BigNumber(
                                                        sanitizedSatAmount || 0
                                                    );

                                                let input: any;
                                                if (satAmountNew.isEqualTo(0)) {
                                                    input = 0;
                                                } else
                                                    input = calculateSendAmount(
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
                                                        bigCeil(serviceFeeSats),
                                                    inputSats: input,
                                                    outputSats:
                                                        Number(
                                                            sanitizedSatAmount
                                                        )
                                                });
                                            }}
                                            hideConversion
                                            sats={
                                                outputSats
                                                    ? units !== 'BTC'
                                                        ? numberWithCommas(
                                                              outputSats.toString()
                                                          )
                                                        : outputSats.toString()
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
                            <View>
                                <TextInput
                                    onChangeText={(text: string) => {
                                        let isValid;
                                        if (reverse) {
                                            isValid = text
                                                ? AddressUtils.isValidBitcoinAddress(
                                                      text,
                                                      true
                                                  )
                                                : false;
                                        } else {
                                            isValid = text
                                                ? AddressUtils.isValidLightningPaymentRequest(
                                                      text
                                                  )
                                                : false;
                                        }
                                        this.setState({
                                            invoice: text,
                                            apiError: '',
                                            apiUpdates: '',
                                            isValid
                                        });
                                    }}
                                    placeholder={
                                        fetchingInvoice
                                            ? ''
                                            : reverse
                                            ? `${localeString(
                                                  'general.enter'
                                              )} ${localeString(
                                                  'views.Settings.AddContact.onchainAddress'
                                              )}`
                                            : `${localeString(
                                                  'general.enter'
                                              )} ${localeString(
                                                  'views.PaymentRequest.title'
                                              )}`
                                    }
                                    style={{
                                        marginHorizontal: 20
                                    }}
                                    value={invoice}
                                />
                                {fetchingInvoice && (
                                    <View style={styles.loadingOverlay}>
                                        <LoadingIndicator />
                                    </View>
                                )}
                            </View>

                            <View
                                style={{
                                    marginVertical: 5
                                }}
                            >
                                <Button
                                    onPress={async () => {
                                        this.setState({
                                            invoice: '',
                                            fetchingInvoice: true
                                        });
                                        try {
                                            const amount =
                                                units === 'sats'
                                                    ? outputSats
                                                    : units === 'BTC'
                                                    ? new BigNumber(outputSats)
                                                          .div(SATS_PER_BTC)
                                                          .toFixed(8)
                                                    : '';

                                            if (!amount) {
                                                this.setState({
                                                    apiError:
                                                        'Please enter a amount!',
                                                    fetchingInvoice: false
                                                });
                                                return;
                                            }

                                            await InvoicesStore.createUnifiedInvoice(
                                                {
                                                    memo: '',
                                                    value:
                                                        amount.toString() ||
                                                        '0',
                                                    expiry: '3600'
                                                }
                                            );

                                            if (reverse) {
                                                if (
                                                    InvoicesStore.onChainAddress
                                                ) {
                                                    this.setState({
                                                        invoice:
                                                            InvoicesStore.onChainAddress,
                                                        apiError: '',
                                                        isValid: true
                                                    });
                                                } else {
                                                    this.setState({
                                                        apiError:
                                                            'Failed to retrieve on-chain address',
                                                        fetchingInvoice: false
                                                    });
                                                }
                                            } else {
                                                if (
                                                    InvoicesStore.payment_request
                                                ) {
                                                    this.setState({
                                                        invoice:
                                                            InvoicesStore.payment_request,
                                                        isValid: true,
                                                        apiError: ''
                                                    });
                                                } else {
                                                    this.setState({
                                                        apiError:
                                                            'Failed to retrieve Lightning payment request',
                                                        fetchingInvoice: false
                                                    });
                                                }
                                            }
                                            this.setState({
                                                fetchingInvoice: false
                                            });
                                        } catch (error: any) {
                                            console.error(
                                                'Error generating invoice:',
                                                error
                                            );
                                            this.setState({
                                                apiError:
                                                    'Failed to generate invoice',
                                                fetchingInvoice: false
                                            });
                                        }
                                    }}
                                    title={
                                        !reverse
                                            ? localeString(
                                                  'views.Receive.createInvoice'
                                              )
                                            : `${localeString(
                                                  'general.create'
                                              )} ${localeString(
                                                  'views.Settings.AddContact.onchainAddress'
                                              )}`
                                    }
                                    secondary
                                    disabled={errorMsg}
                                />
                            </View>

                            <View>
                                <Button
                                    title={localeString('views.Swaps.initiate')}
                                    onPress={() => {
                                        SwapStore.loading = true;
                                        reverse
                                            ? createReverseSwap(invoice)
                                            : createSubmarineSwap(invoice);
                                    }}
                                    containerStyle={{
                                        marginTop: 10
                                    }}
                                    disabled={!isValid}
                                />
                            </View>
                        </>
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
