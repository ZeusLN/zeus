import * as React from 'react';
import { Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';

import lndMobile from '../lndmobile/LndMobileInjection';
const { createRefundTransaction } = lndMobile.swaps;

import Screen from '../components/Screen';
import Header from '../components/Header';
import TextInput from '../components/TextInput';
import OnchainFeeInput from '../components/OnchainFeeInput';
import Button from '../components/Button';
import {
    ErrorMessage,
    SuccessMessage
} from '../components/SuccessErrorMessage';
import LoadingIndicator from '../components/LoadingIndicator';

import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';

import SwapStore, { HOST } from '../stores/SwapStore';
import NodeInfoStore from '../stores/NodeInfoStore';

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
}

interface RefundSwapState {
    destinationAddress: string;
    fee: string;
    error: string;
    swapData: any;
    loading: boolean;
    refundStatus: string;
}

@inject('SwapStore', 'NodeInfoStore')
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
        refundStatus: ''
    };

    createRefundTransaction = async (
        swapData: any,
        lockupTransaction: any,
        fee: any,
        endpoint: string,
        destinationAddress: string
    ): Promise<void> => {
        try {
            const txid = await createRefundTransaction({
                endpoint: endpoint.replace('/v2', ''),
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
                isTestnet: this.props.NodeInfoStore!.nodeInfo.isTestNet
            });
            this.setState({
                loading: false,
                refundStatus: `Refund transaction created successfully. TXID: ${txid}`
            });

            console.log('Refund transaction created successfully. TXID:', txid);
        } catch (error: any) {
            this.setState({ loading: false, error: error.message });
            console.error('Error creating refund transaction:', error);
            throw error;
        }
    };

    render() {
        const { navigation, SwapStore } = this.props;
        const {
            fee,
            destinationAddress,
            swapData,
            error,
            loading,
            refundStatus
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
                    navigation={this.props.navigation}
                />
                <View style={{ paddingHorizontal: 20 }}>
                    {loading && (
                        <View style={{ marginBottom: 20 }}>
                            <LoadingIndicator />
                        </View>
                    )}
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
                    <TextInput
                        onChangeText={async (text: string) => {
                            this.setState({
                                destinationAddress: text,
                                error: ''
                            });
                        }}
                        placeholder={localeString(
                            'views.Swaps.enterRefundAddress'
                        )}
                        value={destinationAddress}
                    />
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
                                HOST,
                                destinationAddress
                            );

                            console.log(
                                'Refund transaction created successfully.'
                            );
                        } catch (error) {
                            console.error('Error in refund process:', error);
                        } finally {
                            this.setState({ loading: false });
                        }
                    }}
                    secondary
                    disabled={!destinationAddress || this.state.loading}
                />
            </Screen>
        );
    }
}
