import React, { Component } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import AmountInput, { getSatAmount } from '../../components/AmountInput';
import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';
import CollapsedQR from '../../components/CollapsedQR';
const ZIconWhite = require('../../assets/images/icon_white.png');
const ZIcon = require('../../assets/images/icon_black.png');

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import ChannelsStore from '../../stores/ChannelsStore';
import InvoicesStore from '../../stores/InvoicesStore';
import ModalStore from '../../stores/ModalStore';
import UnitsStore from '../../stores/UnitsStore';

import LoadingIndicator from '../../components/LoadingIndicator';
import {
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';
import { Icon } from '@rneui/themed';

interface CreateWithdrawalRequestProps {
    navigation: NativeStackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    InvoicesStore: InvoicesStore;
    ModalStore: ModalStore;
    UnitsStore: UnitsStore;
}

interface CreateWithdrawalRequestState {
    satsAmount: string;
    amount: string;
    description: string;
    bolt12: string;
    showQR: boolean;
    loading: boolean;
    error_msg: string | null;
    withdrawalRequestCreationError: boolean;
}

@inject('ChannelsStore', 'InvoicesStore', 'ModalStore', 'UnitsStore')
@observer
export default class CreateWithdrawalRequest extends Component<
    CreateWithdrawalRequestProps,
    CreateWithdrawalRequestState
> {
    constructor(props: CreateWithdrawalRequestProps) {
        super(props);
        this.state = {
            satsAmount: '',
            amount: '',
            description: '',
            bolt12: '',
            showQR: false,
            loading: false,
            error_msg: null,
            withdrawalRequestCreationError: false
        };
    }

    handleInputChange = (key: 'amount' | 'description', value: string) => {
        if (key === 'amount') {
            const { units } = this.props.UnitsStore;
            const isBTC = units === 'BTC';
            const isFiat = units === 'fiat';

            let satsAmount: string;
            if (isBTC) {
                satsAmount = (
                    Number(getSatAmount(value, 'BTC')) * 1000
                ).toString();
            } else if (isFiat) {
                satsAmount = (
                    Number(getSatAmount(value, 'fiat')) * 1000
                ).toString();
            } else {
                satsAmount = (parseInt(value) * 1000).toString();
            }

            this.setState({
                amount: value,
                satsAmount
            });
        } else if (key === 'description') {
            this.setState({
                description: value
            });
            this.props.InvoicesStore.clearUnified();
        }
    };

    generateInvoice = async () => {
        const { description, satsAmount } = this.state;
        this.setState({ loading: true, error_msg: null }, async () => {
            try {
                const response = await BackendUtils.createWithdrawalRequest({
                    amount: satsAmount,
                    description
                });

                if (response && response.bolt12) {
                    this.setState({
                        bolt12: response.bolt12,
                        showQR: true,
                        amount: '',
                        description: '',
                        error_msg: null,
                        withdrawalRequestCreationError: false
                    });
                } else {
                    this.setState({
                        error_msg: localeString(
                            'views.Tools.ErrorCreateWithdrawalRequest'
                        )
                    });
                }
            } catch (error: any) {
                this.setState({
                    error_msg:
                        error.toString() ||
                        localeString(
                            'views.Tools.ErrorCreateWithdrawalRequest'
                        ),
                    showQR: false,
                    withdrawalRequestCreationError: true
                });
            } finally {
                this.setState({ loading: false });
            }
        });
    };

    render() {
        const { navigation, ChannelsStore, ModalStore } = this.props;
        const { amount, description, satsAmount } = this.state;
        const hasBalance = ChannelsStore.totalOutbound > 0;
        const disabled =
            !description || !amount || this.state.loading || !hasBalance;

        const ClearButton = () => (
            <Icon
                name="cancel"
                onPress={() => {
                    this.setState({
                        showQR: false,
                        error_msg: null,
                        withdrawalRequestCreationError: false
                    });
                    this.props.InvoicesStore.clearUnified();
                }}
                color={themeColor('text')}
                underlayColor="transparent"
                size={30}
            />
        );

        const InfoButton = () => (
            <View style={{ marginRight: 5 }}>
                <Icon
                    name="info"
                    onPress={() => {
                        ModalStore.toggleInfoModal({
                            title: localeString('general.withdrawalRequest'),
                            text: [
                                localeString(
                                    'views.Tools.withdrawal.infoModal.line1'
                                ),
                                localeString(
                                    'views.Tools.withdrawal.infoModal.line2'
                                ),
                                localeString(
                                    'views.Tools.withdrawal.infoModal.line3'
                                ),
                                localeString('general.bolt12Requirement')
                            ]
                        });
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={30}
                />
            </View>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('general.withdrawalRequest'),
                        style: {
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('text')
                        }
                    }}
                    rightComponent={
                        this.state.showQR ? <ClearButton /> : <InfoButton />
                    }
                    navigation={navigation}
                />

                {this.state.loading ? (
                    <View style={{ marginTop: 40 }}>
                        <LoadingIndicator />
                    </View>
                ) : this.state.showQR && this.state.bolt12 ? (
                    <View style={{ padding: 20 }}>
                        <CollapsedQR
                            value={this.state.bolt12 || ''}
                            iconOnly={true}
                            showShare={true}
                            expanded
                            textBottom
                            truncateLongValue
                            logo={
                                themeColor('invertQrIcons') ? ZIconWhite : ZIcon
                            }
                            satAmount={satsAmount}
                        />
                    </View>
                ) : (
                    <>
                        <View style={{ paddingRight: 20, paddingLeft: 20 }}>
                            {this.state.withdrawalRequestCreationError && (
                                <ErrorMessage
                                    message={localeString(
                                        'views.Tools.ErrorCreateWithdrawalRequest'
                                    )}
                                />
                            )}

                            {this.state.error_msg && (
                                <ErrorMessage message={this.state.error_msg} />
                            )}
                        </View>

                        <ScrollView
                            style={{ padding: 20 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            {!hasBalance && (
                                <WarningMessage
                                    message={localeString(
                                        'views.Tools.withdrawal.noBalanceWarning'
                                    )}
                                />
                            )}
                            <Text
                                style={{ color: themeColor('secondaryText') }}
                            >
                                {localeString(
                                    'views.PaymentRequest.description'
                                )}
                            </Text>

                            <TextInput
                                placeholder={localeString(
                                    'views.Tools.withdrawal.descriptionPlaceholder'
                                )}
                                value={description}
                                onChangeText={(text: string) =>
                                    this.handleInputChange('description', text)
                                }
                            />

                            <View style={{ paddingBottom: 15 }}>
                                <Text
                                    style={{
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString('views.Receive.amount')}
                                </Text>
                                <AmountInput
                                    amount={amount}
                                    onAmountChange={(value) =>
                                        this.handleInputChange('amount', value)
                                    }
                                />
                            </View>

                            <View style={{ paddingTop: 10 }}>
                                <Button
                                    title={localeString(
                                        'views.Tools.withdrawal.createWithdrawalRequest'
                                    )}
                                    onPress={this.generateInvoice}
                                    disabled={disabled}
                                />
                            </View>
                        </ScrollView>
                    </>
                )}
            </Screen>
        );
    }
}
