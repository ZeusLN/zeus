import * as React from 'react';
import { ScrollView, View } from 'react-native';
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
import Accordion from '../../components/Accordion';
import AddressInput from '../../components/AddressInput';
import {
    ErrorMessage,
    SuccessMessage
} from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import BackendUtils from '../../utils/BackendUtils';
import { localeString, pascalToHumanReadable } from '../../utils/LocaleUtils';
import { privateKeyFromSwapKeys } from '../../utils/SwapUtils';
import { themeColor } from '../../utils/ThemeUtils';

import SwapStore from '../../stores/SwapStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import InvoicesStore from '../../stores/InvoicesStore';

import Swap from '../../models/Swap';

const DEFAULT_FEE_RATE = 2;

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
        fetchingAddress: false
    };

    private scrollViewRef = React.createRef<ScrollView>();

    getBaseEndpoint = (endpoint: string): string => endpoint.replace('/v2', '');

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

        if (response.info().status !== 200) {
            return null;
        }

        let data;
        try {
            data = response.json();
        } catch (e) {
            console.error('Failed to parse swap data JSON', e);
            return null;
        }

        return data?.transaction?.hex || null;
    };

    getReversePreimageHex = async (swapData: Swap): Promise<string | null> => {
        const preimage = swapData.preimage;

        if (typeof preimage === 'string') {
            return preimage;
        }

        if (preimage instanceof Uint8Array) {
            return Buffer.from(preimage).toString('hex');
        }

        if (preimage?.data) {
            return Buffer.from(preimage.data).toString('hex');
        }

        const keyIndex = Number(swapData.keyIndex);

        if (!Number.isInteger(keyIndex) || keyIndex < 0) {
            return null;
        }

        const derivedPreimage =
            await this.props.SwapStore?.derivePreimageFromRescueKey(keyIndex);

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
                endpoint: this.getBaseEndpoint(swapData.endpoint),
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
        try {
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
                throw new Error(
                    localeString('views.Swaps.error.missingClaimLeaf')
                );
            }

            if (!refundLeafOutput) {
                throw new Error(
                    localeString('views.Swaps.error.missingRefundLeaf')
                );
            }

            if (!refundPubKey) {
                throw new Error(
                    localeString('views.Swaps.error.missingRefundPubKey')
                );
            }

            if (!effectiveLockupAddress) {
                throw new Error(
                    localeString('views.Swaps.error.missingLockupAddress')
                );
            }

            if (!nodeInfo) {
                throw new Error(
                    localeString('views.Swaps.error.nodeInfoUnavailable')
                );
            }

            const privateKey = privateKeyFromSwapKeys(swapData.keys);
            if (!privateKey) {
                throw new Error(
                    localeString('views.Swaps.error.missingPrivateKey')
                );
            }

            const transactionHex = await this.getReverseTransactionHex(
                swapData
            );

            if (!transactionHex) {
                throw new Error(
                    localeString('views.Swaps.error.missingLockupTx')
                );
            }

            const preimageHex = await this.getReversePreimageHex(swapData);

            if (!preimageHex) {
                throw new Error(
                    localeString('views.Swaps.error.missingPreimage')
                );
            }

            await createReverseClaimTransaction({
                endpoint: this.getBaseEndpoint(endpoint),
                swapId: id,
                claimLeaf: claimLeafOutput,
                refundLeaf: refundLeafOutput,
                privateKey,
                servicePubKey: refundPubKey,
                preimageHex,
                transactionHex,
                lockupAddress: effectiveLockupAddress,
                destinationAddress,
                feeRate: Number(fee || DEFAULT_FEE_RATE),
                minerFee: this.props.SwapStore?.claimMinerFee || 0,
                isTestnet: nodeInfo.isTestNet
            });

            this.setState({
                refundStatus: localeString('views.Swaps.claimSuccess'),
                destinationAddress: ''
            });
        } catch (error: any) {
            this.setState({
                loading: false,
                error: error.message
            });
            console.error('Error creating reverse claim transaction:', error);
            throw error;
        }
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
            fetchingAddress
        } = this.state;

        const rawDetails = {
            endpoint: this.getBaseEndpoint(swapData.endpoint),
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
                <ScrollView
                    ref={this.scrollViewRef}
                    style={{ flex: 1, paddingHorizontal: 20 }}
                >
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
                                'RefundSwapQRScanner'
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

                    <Accordion
                        id="refund-raw-details"
                        title="Raw details"
                        headerLayout="form"
                        embedded
                        scrollRef={this.scrollViewRef}
                        headerStyle={{
                            marginTop: 10,
                            marginBottom: 10
                        }}
                        renderFormTitle={() => (
                            <KeyValue
                                keyValue={'Raw details'}
                                color={themeColor('secondaryText')}
                            />
                        )}
                    >
                        <>
                            {Object.entries(rawDetails).map(([key, value]) => {
                                if (!value) return;
                                return (
                                    <KeyValue
                                        key={key}
                                        keyValue={pascalToHumanReadable(key)}
                                        value={value.toString()}
                                    />
                                );
                            })}
                        </>
                    </Accordion>
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
