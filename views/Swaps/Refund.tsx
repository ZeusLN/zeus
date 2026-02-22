import * as React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';

import lndMobile from '../../lndmobile/LndMobileInjection';
const { createRefundTransaction, createReverseClaimTransaction } =
    lndMobile.swaps;

import Button from '../../components/Button';

import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import OnchainFeeInput from '../../components/OnchainFeeInput';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import AddressInput from '../../components/AddressInput';
import {
    ErrorMessage,
    SuccessMessage
} from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import BackendUtils from '../../utils/BackendUtils';
import { localeString, pascalToHumanReadable } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import SwapStore from '../../stores/SwapStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import InvoicesStore from '../../stores/InvoicesStore';

import Swap from '../../models/Swap';

import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';

interface RefundSwapProps {
    navigation: any;
    route: Route<
        'RefundSwap',
        {
            swapData: Swap;
            scannedAddress?: string;
        }
    >;
    SwapStore?: SwapStore;
    NodeInfoStore?: NodeInfoStore;
    InvoicesStore?: InvoicesStore;
}

interface RefundSwapState {
    destinationAddress: string;
    fee: string;
    error: string;
    swapData: Swap;
    loading: boolean;
    refundStatus: string;
    uncooperative: boolean;
    fetchingAddress: boolean;
    rawToggle: boolean;
}

@inject('SwapStore', 'NodeInfoStore', 'InvoicesStore')
@observer
export default class RefundSwap extends React.Component<
    RefundSwapProps,
    RefundSwapState
> {
    state = {
        destinationAddress: '',
        fee: '',
        error: '',
        loading: false,
        swapData: this.props.route.params.swapData,
        refundStatus: '',
        uncooperative: false,
        fetchingAddress: false,
        rawToggle: false
    };

    getPrivateKey = (swapData: Swap): string | null => {
        if (swapData.refundPrivateKey) {
            return swapData.refundPrivateKey;
        }

        const dObject = swapData.keys?.__D;
        if (!dObject) {
            return null;
        }

        return Object.keys(dObject)
            .map((key) => parseInt(key, 10))
            .sort((a, b) => a - b)
            .map((key) => dObject[key])
            .map((byte: number) => byte.toString(16).padStart(2, '0'))
            .join('');
    };

    getReverseTransactionHex = async (
        swapData: Swap
    ): Promise<string | null> => {
        if (swapData.lockupTransaction?.hex) {
            return swapData.lockupTransaction.hex;
        }

        const response = await ReactNativeBlobUtil.fetch(
            'GET',
            `${swapData.endpoint}/swap/${swapData.id}`,
            { 'Content-Type': 'application/json' }
        );
        const data = response.json();
        return data?.transaction?.hex || null;
    };

    getReversePreimageHex = async (swapData: Swap): Promise<string | null> => {
        const preimage: any = swapData.preimage;

        if (typeof preimage === 'string') {
            return preimage;
        }

        if (preimage?.data) {
            return Buffer.from(preimage.data).toString('hex');
        }

        if (typeof swapData.keyIndex !== 'number') {
            return null;
        }

        const derivedPreimage =
            await this.props.SwapStore?.derivePreimageFromRescueKey(
                swapData.keyIndex
            );

        return derivedPreimage
            ? Buffer.from(derivedPreimage).toString('hex')
            : null;
    };

    createRefundTransaction = async (
        swapData: Swap,
        fee: any,
        destinationAddress: string
    ): Promise<void> => {
        const { SwapStore } = this.props;
        const { uncooperative } = this.state;

        try {
            const txid = await createRefundTransaction({
                endpoint: swapData.endpoint.replace('/v2', ''),
                swapId: swapData.id,
                claimLeaf: swapData?.swapTreeDetails.claimLeaf.output,
                refundLeaf: swapData?.swapTreeDetails.refundLeaf.output,
                transactionHex: swapData.lockupTransaction?.hex,
                privateKey: swapData.refundPrivateKey!,
                servicePubKey: swapData.servicePubKey!,
                feeRate: Number(fee),
                timeoutBlockHeight: Number(swapData.timeoutBlockHeight),
                destinationAddress,
                lockupAddress: swapData.effectiveLockupAddress!,
                cooperative: !uncooperative,
                isTestnet: this.props.NodeInfoStore!.nodeInfo.isTestNet
            });

            await SwapStore?.updateSwapOnRefund(swapData.id, txid);

            this.setState({
                loading: false,
                refundStatus: `Refund transaction created successfully. TXID: ${txid}`,
                destinationAddress: ''
            });

            console.log('Refund transaction created successfully. TXID:', txid);
        } catch (error: any) {
            this.setState({
                loading: false,
                error: error.message
            });
            console.error('Error creating refund transaction:', error);
            throw error;
        }
    };

    createReverseClaimTransaction = async (
        swapData: Swap,
        fee: any,
        destinationAddress: string
    ): Promise<void> => {
        const {
            swapTreeDetails,
            refundPubKey,
            effectiveLockupAddress,
            endpoint,
            id
        } = swapData;
        const claimLeafOutput = swapTreeDetails?.claimLeaf?.output;
        const refundLeafOutput = swapTreeDetails?.refundLeaf?.output;
        const nodeInfo = this.props.NodeInfoStore?.nodeInfo;

        if (!claimLeafOutput) {
            throw new Error('Could not find claim leaf output in swap data');
        }

        if (!refundLeafOutput) {
            throw new Error('Could not find refund leaf output in swap data');
        }

        if (!refundPubKey) {
            throw new Error('Could not find refund public key in swap data');
        }

        if (!effectiveLockupAddress) {
            throw new Error('Could not find lockup address in swap data');
        }

        if (!nodeInfo) {
            throw new Error('Node info is not available');
        }

        const privateKey = this.getPrivateKey(swapData);
        if (!privateKey) {
            throw new Error('Could not derive swap private key');
        }

        const transactionHex = await this.getReverseTransactionHex(swapData);

        if (!transactionHex) {
            throw new Error('Could not fetch swap lockup transaction');
        }

        const preimageHex = await this.getReversePreimageHex(swapData);

        if (!preimageHex) {
            throw new Error('Could not derive swap preimage from rescue key');
        }

        await createReverseClaimTransaction({
            endpoint,
            swapId: id,
            claimLeaf: claimLeafOutput,
            refundLeaf: refundLeafOutput,
            privateKey,
            servicePubKey: refundPubKey,
            preimageHex,
            transactionHex,
            lockupAddress: effectiveLockupAddress,
            destinationAddress,
            feeRate: Number(fee || 2),
            isTestnet: nodeInfo.isTestNet
        });

        this.setState({
            refundStatus: 'Claim transaction created successfully.',
            destinationAddress: ''
        });
    };

    componentDidUpdate(prevProps: Readonly<RefundSwapProps>) {
        const { route, navigation } = this.props;
        const scannedAddress = route.params?.scannedAddress;

        if (
            scannedAddress &&
            scannedAddress !== prevProps.route.params?.scannedAddress
        ) {
            this.setState({ destinationAddress: scannedAddress, error: '' });

            navigation.setParams({ scannedAddress: undefined });
        }
    }

    render() {
        const { navigation, SwapStore, InvoicesStore } = this.props;
        const {
            fee,
            destinationAddress,
            swapData,
            error,
            loading,
            refundStatus,
            uncooperative,
            fetchingAddress,
            rawToggle
        } = this.state;

        const rawDetails = {
            endpoint: swapData.endpoint.replace('/v2', ''),
            swapId: swapData.id,
            claimLeaf: swapData?.swapTreeDetails.claimLeaf.output,
            refundLeaf: swapData?.swapTreeDetails.refundLeaf.output,
            transactionHex: swapData.lockupTransaction?.hex,
            privateKey: swapData.refundPrivateKey,
            servicePubKey: swapData.isReverseSwap
                ? swapData.refundPubKey
                : swapData.servicePubKey,
            feeRate: Number(fee),
            timeoutBlockHeight: Number(swapData.timeoutBlockHeight),
            destinationAddress,
            lockupAddress: swapData.effectiveLockupAddress,
            cooperative: !uncooperative,
            isTestnet: this.props.NodeInfoStore!.nodeInfo.isTestNet
        };

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Swaps.refundSwap'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? (
                            <View style={{ marginTop: -6 }}>
                                <LoadingIndicator size={32} />
                            </View>
                        ) : (
                            <></>
                        )
                    }
                    navigation={this.props.navigation}
                />
                <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
                    {error && (
                        <View style={{ marginBottom: 10 }}>
                            <ErrorMessage message={error} />
                        </View>
                    )}
                    {refundStatus && (
                        <View style={{ marginBottom: 10 }}>
                            <SuccessMessage message={refundStatus} />
                        </View>
                    )}

                    <Text style={{ color: themeColor('secondaryText') }}>
                        {localeString('views.Transaction.destAddress')}
                    </Text>

                    <AddressInput
                        value={destinationAddress}
                        onChangeText={async (text: string) => {
                            this.setState({
                                destinationAddress: text,
                                error: ''
                            });
                        }}
                        onScan={() =>
                            this.props.navigation.navigate(
                                'HandleAnythingQRScanner',
                                {
                                    view: 'RefundSwap'
                                }
                            )
                        }
                        placeholder={fetchingAddress ? '' : 'bc1...'}
                        loading={fetchingAddress}
                    />
                    <View
                        style={{
                            marginVertical: 5
                        }}
                    >
                        {BackendUtils.supportsOnchainSends() && (
                            <Button
                                onPress={async () => {
                                    this.setState({
                                        destinationAddress: '',
                                        fetchingAddress: true
                                    });
                                    try {
                                        if (InvoicesStore) {
                                            await InvoicesStore.createUnifiedInvoice(
                                                {
                                                    memo: '',
                                                    value: '0',
                                                    expirySeconds: '3600'
                                                }
                                            );
                                            if (InvoicesStore.onChainAddress) {
                                                this.setState({
                                                    destinationAddress:
                                                        InvoicesStore.onChainAddress,
                                                    error: '',
                                                    fetchingAddress: false
                                                });
                                            } else {
                                                this.setState({
                                                    error: localeString(
                                                        'views.Swaps.generateOnchainAddressFailed'
                                                    ),
                                                    fetchingAddress: false
                                                });
                                            }
                                        }

                                        this.setState({
                                            fetchingAddress: false
                                        });
                                    } catch (e: any) {
                                        console.error(
                                            'Error generating invoice:',
                                            e
                                        );
                                        this.setState({
                                            error: localeString(
                                                'views.Swaps.generateInvoiceFailed'
                                            ),
                                            fetchingAddress: false
                                        });
                                    }
                                }}
                                title={localeString(
                                    'views.Swaps.generateOnchainAddress'
                                )}
                                disabled={fetchingAddress}
                            />
                        )}
                    </View>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            marginTop: 10
                        }}
                    >
                        {localeString('views.Send.feeSatsVbyte')}
                    </Text>
                    <OnchainFeeInput
                        fee={fee}
                        onChangeFee={(text: string) =>
                            this.setState({ fee: text, error: '' })
                        }
                        navigation={navigation}
                    />
                    {!swapData.isReverseSwap && (
                        <Row>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    marginTop: 4
                                }}
                                infoModalText={localeString(
                                    'views.Swaps.infoText'
                                )}
                            >
                                {localeString('views.Swaps.uncooperative')}
                            </Text>
                            <View
                                style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    justifyContent: 'flex-end',
                                    marginTop: 4
                                }}
                            >
                                <Switch
                                    value={uncooperative}
                                    onValueChange={async () => {
                                        this.setState({
                                            uncooperative: !uncooperative
                                        });
                                    }}
                                />
                            </View>
                        </Row>
                    )}

                    <TouchableOpacity
                        onPress={() => {
                            this.setState({
                                rawToggle: !rawToggle
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
                                <View style={{ flex: 1 }}>
                                    <KeyValue
                                        keyValue={'Raw details'}
                                        color={themeColor('secondaryText')}
                                    />
                                </View>
                                {rawToggle ? (
                                    <CaretDown
                                        fill={themeColor('secondaryText')}
                                        width="20"
                                        height="20"
                                    />
                                ) : (
                                    <CaretRight
                                        fill={themeColor('secondaryText')}
                                        width="20"
                                        height="20"
                                    />
                                )}
                            </Row>
                        </View>
                    </TouchableOpacity>

                    {rawToggle &&
                        Object.entries(rawDetails).map(([key, value]) => {
                            if (!value) return;
                            return (
                                <KeyValue
                                    keyValue={pascalToHumanReadable(key)}
                                    value={value.toString()}
                                />
                            );
                        })}
                </ScrollView>

                <View style={{ marginBottom: 15 }}>
                    <Button
                        title={
                            swapData.isReverseSwap
                                ? localeString(
                                      'views.Settings.LightningAddressInfo.redeem'
                                  )
                                : localeString('views.Swaps.initiateRefund')
                        }
                        onPress={async () => {
                            this.setState({
                                loading: true,
                                error: '',
                                refundStatus: ''
                            });

                            if (
                                !swapData.isReverseSwap &&
                                !swapData.lockupTransaction
                            ) {
                                swapData.lockupTransaction =
                                    await SwapStore?.getLockupTransaction(
                                        swapData.id
                                    );
                            }

                            try {
                                if (swapData.isReverseSwap) {
                                    await this.createReverseClaimTransaction(
                                        swapData,
                                        fee,
                                        destinationAddress
                                    );
                                } else {
                                    await this.createRefundTransaction(
                                        swapData,
                                        fee,
                                        destinationAddress
                                    );
                                }

                                console.log(
                                    'Swap transaction created successfully.'
                                );
                            } catch (e) {
                                console.error('Error in refund process:', e);
                            } finally {
                                this.setState({ loading: false });
                            }
                        }}
                        containerStyle={{ marginTop: 20 }}
                        secondary
                        disabled={
                            !destinationAddress ||
                            this.state.loading ||
                            fetchingAddress
                        }
                    />
                </View>
            </Screen>
        );
    }
}
