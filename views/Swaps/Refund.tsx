import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';

import lndMobile from '../../lndmobile/LndMobileInjection';
const { createRefundTransaction } = lndMobile.swaps;

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import OnchainFeeInput from '../../components/OnchainFeeInput';
import Button from '../../components/Button';
import {
    ErrorMessage,
    SuccessMessage
} from '../../components/SuccessErrorMessage';
import LoadingIndicator from '../../components/LoadingIndicator';
import Switch from '../../components/Switch';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import BackendUtils from '../../utils/BackendUtils';

import SwapStore from '../../stores/SwapStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import InvoicesStore from '../../stores/InvoicesStore';

interface RefundSwapProps {
    navigation: any;
    route: Route<
        'RefundSwap',
        {
            swapData: any;
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
    swapData: any;
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

    createRefundTransaction = async (
        swapData: any,
        lockupTransaction: any,
        fee: any,
        destinationAddress: string
    ): Promise<void> => {
        const { SwapStore } = this.props;
        const { uncooperative } = this.state;

        try {
            const txid = await createRefundTransaction({
                endpoint: swapData.endpoint.replace('/v2', ''),
                swapId: swapData.id,
                claimLeaf: swapData.swapTree.claimLeaf.output,
                refundLeaf: swapData.swapTree.refundLeaf.output,
                transactionHex: lockupTransaction.hex,
                privateKey: swapData.refundPrivateKey,
                servicePubKey: swapData.claimPublicKey,
                feeRate: Number(fee),
                timeoutBlockHeight: Number(swapData.timeoutBlockHeight),
                destinationAddress,
                lockupAddress: swapData.address,
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
                error: error.message,
                destinationAddress: ''
            });
            console.error('Error creating refund transaction:', error);
            throw error;
        }
    };

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
                <View style={{ paddingHorizontal: 20 }}>
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

                    <View>
                        <TextInput
                            onChangeText={async (text: string) => {
                                this.setState({
                                    destinationAddress: text,
                                    error: ''
                                });
                            }}
                            placeholder={fetchingAddress ? '' : 'bc1...'}
                            value={destinationAddress}
                        />
                        {fetchingAddress && (
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
                                                    expiry: '3600'
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
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            marginTop: 4
                        }}
                        infoModalText={localeString('views.Swaps.infoText')}
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
                </View>

                <Button
                    title={localeString('views.Swaps.initiateRefund')}
                    onPress={async () => {
                        this.setState({
                            loading: true,
                            error: '',
                            refundStatus: ''
                        });

                        try {
                            // Fetch the lockup transaction
                            const lockupTransaction =
                                await SwapStore?.getLockupTransaction(
                                    swapData.id
                                );

                            // Create and submit the refund transaction
                            await this.createRefundTransaction(
                                swapData,
                                lockupTransaction,
                                fee,
                                destinationAddress
                            );

                            console.log(
                                'Refund transaction created successfully.'
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
