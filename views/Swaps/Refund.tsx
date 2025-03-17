import * as React from 'react';
import { View } from 'react-native';
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

import SwapStore, { HOST } from '../../stores/SwapStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import EncryptedStorage from 'react-native-encrypted-storage';

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
    cooperative: boolean;
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
        refundStatus: '',
        cooperative: false
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
                isTestnet: this.props.NodeInfoStore!.nodeInfo.isTestNet,
                cooperative: this.state.cooperative
            });

            await this.updateSwapInStorage(swapData.id, txid);

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

    updateSwapInStorage = async (swapId: string, txid: string) => {
        try {
            // Retrieve the swaps from encrypted storage
            const storedSwaps = await EncryptedStorage.getItem('swaps');
            if (!storedSwaps) {
                throw new Error('No swaps found in storage');
            }

            // Parse the swaps array
            const swaps = storedSwaps ? JSON.parse(storedSwaps) : [];

            // Find the swap by swapId
            const swapIndex = swaps.findIndex(
                (swap: any) => swap.id === swapId
            );
            if (swapIndex === -1) {
                throw new Error(`Swap with ID ${swapId} not found`);
            }

            // Update the swap
            swaps[swapIndex].status = 'transaction.refunded';
            swaps[swapIndex].txid = txid;

            // Save the updated swaps back to encrypted storage
            await EncryptedStorage.setItem('swaps', JSON.stringify(swaps));

            console.log('Swap updated in storage:', swaps[swapIndex]);
        } catch (error) {
            console.error('Error updating swap in storage:', error);
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
            refundStatus,
            cooperative
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
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            marginTop: 4
                        }}
                        infoModalText={localeString('views.Swaps.infoText')}
                    >
                        {localeString('views.Swaps.cooperative')}
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
                            value={cooperative}
                            onValueChange={async () => {
                                this.setState({
                                    cooperative: !cooperative
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
                                HOST,
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
                    disabled={!destinationAddress || this.state.loading}
                />
            </Screen>
        );
    }
}
