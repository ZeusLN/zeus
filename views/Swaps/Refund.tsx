import * as React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';

import lndMobile from '../../lndmobile/LndMobileInjection';
const { createRefundTransaction } = lndMobile.swaps;

import { ButtonGroup } from '@rneui/themed';

import Button from '../../components/Button';

import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import OnchainFeeInput from '../../components/OnchainFeeInput';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import AddressInput from '../../components/AddressInput';
import {
    ErrorMessage,
    SuccessMessage
} from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import BackendUtils from '../../utils/BackendUtils';
import { localeString, pascalToHumanReadable } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import {
    buttonTextStyle,
    getButtonGroupStyles
} from '../../utils/buttonGroupStyles';

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
    feeRate: string;
    minerFee: string;
    selectedFeeIndex: number;
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
        feeRate: '',
        minerFee: '',
        selectedFeeIndex: 0,
        error: '',
        loading: false,
        swapData: this.props.route.params.swapData,
        refundStatus: '',
        uncooperative: false,
        fetchingAddress: false,
        rawToggle: false
    };

    createRefundTransaction = async (
        swapData: Swap,
        feeRate: string,
        minerFee: string,
        destinationAddress: string
    ): Promise<void> => {
        const { SwapStore } = this.props;
        const { uncooperative, selectedFeeIndex } = this.state;
        const isMinerFeeMode = selectedFeeIndex === 1;

        try {
            const txid = await createRefundTransaction({
                endpoint: swapData.endpoint.replace('/v2', ''),
                swapId: swapData.id,
                claimLeaf: swapData?.swapTreeDetails.claimLeaf.output,
                refundLeaf: swapData?.swapTreeDetails.refundLeaf.output,
                transactionHex: swapData.lockupTransaction?.hex,
                privateKey: swapData.refundPrivateKey!,
                servicePubKey: swapData.servicePubKey!,
                feeRate: !isMinerFeeMode ? Number(feeRate) : 0,
                minerFee: isMinerFeeMode ? Number(minerFee) : 0,
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
            feeRate,
            minerFee,
            selectedFeeIndex,
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
            servicePubKey: swapData.servicePubKey,
            feeRate: selectedFeeIndex === 0 ? Number(feeRate) : 0,
            minerFee: selectedFeeIndex === 1 ? Number(minerFee) : 0,
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
                    <ButtonGroup
                        onPress={(index: number) =>
                            this.setState({
                                selectedFeeIndex: index,
                                error: ''
                            })
                        }
                        selectedIndex={selectedFeeIndex}
                        buttons={[
                            {
                                element: () => (
                                    <Text
                                        style={{
                                            ...buttonTextStyle,
                                            color:
                                                selectedFeeIndex === 0
                                                    ? themeColor('background')
                                                    : themeColor('text')
                                        }}
                                    >
                                        {localeString('views.Swaps.feeRate')}
                                    </Text>
                                )
                            },
                            {
                                element: () => (
                                    <Text
                                        style={{
                                            ...buttonTextStyle,
                                            color:
                                                selectedFeeIndex === 1
                                                    ? themeColor('background')
                                                    : themeColor('text')
                                        }}
                                    >
                                        {localeString('views.Swaps.minerFee')}
                                    </Text>
                                )
                            }
                        ]}
                        selectedButtonStyle={
                            getButtonGroupStyles().selectedButtonStyle
                        }
                        containerStyle={{
                            ...getButtonGroupStyles().containerStyle,
                            marginTop: 14
                        }}
                        innerBorderStyle={
                            getButtonGroupStyles().innerBorderStyle
                        }
                    />
                    {selectedFeeIndex === 0 ? (
                        <>
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.Send.feeSatsVbyte')}
                            </Text>
                            <OnchainFeeInput
                                fee={feeRate}
                                onChangeFee={(text: string) =>
                                    this.setState({ feeRate: text, error: '' })
                                }
                                navigation={navigation}
                            />
                        </>
                    ) : (
                        <>
                            <Text
                                style={{
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {`${localeString(
                                    'views.Swaps.minerFee'
                                )} (${localeString('general.sats')})`}
                            </Text>
                            <TextInput
                                value={minerFee}
                                onChangeText={(text: string) =>
                                    this.setState({ minerFee: text, error: '' })
                                }
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </>
                    )}
                    <Row>
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
                    </Row>

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
                        title={localeString('views.Swaps.initiateRefund')}
                        onPress={async () => {
                            this.setState({
                                loading: true,
                                error: '',
                                refundStatus: ''
                            });

                            if (!swapData.lockupTransaction) {
                                swapData.lockupTransaction =
                                    await SwapStore?.getLockupTransaction(
                                        swapData.id
                                    );
                            }

                            try {
                                await this.createRefundTransaction(
                                    swapData,
                                    feeRate,
                                    minerFee,
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
                            fetchingAddress ||
                            (selectedFeeIndex === 1 && !minerFee)
                        }
                    />
                </View>
            </Screen>
        );
    }
}
