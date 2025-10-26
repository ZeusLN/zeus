import React, { Component } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import AmountInput, { getSatAmount } from '../../components/AmountInput';
import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';
import CollapsedQR from '../../components/CollapsedQR';
const ZIconWhite = require('../../assets/images/icon-white.png');
const ZIcon = require('../../assets/images/icon-black.png');

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import InvoicesStore from '../../stores/InvoicesStore';
import BalanceStore from '../../stores/BalanceStore';
import UnitsStore from '../../stores/UnitsStore';

import LoadingIndicator from '../../components/LoadingIndicator';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Icon } from '@rneui/themed';

import Storage from '../../storage';

interface CreateWithdrawalRequestProps {
    navigation: StackNavigationProp<any, any>;
    InvoicesStore: InvoicesStore;
    BalanceStore: BalanceStore;
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

@inject('InvoicesStore', 'BalanceStore', 'UnitsStore')
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
                    await Storage.setItem(
                        `withdrawalRequest_${response.bolt12}`,
                        Date.now()
                    );
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
        const { navigation, BalanceStore } = this.props;
        const { amount, description, satsAmount } = this.state;
        const hasBalance =
            Number(BalanceStore.confirmedBlockchainBalance) > 0 ||
            Number(BalanceStore.unconfirmedBlockchainBalance) > 0;
        const disabled =
            !description || !amount || !hasBalance || this.state.loading;

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
                        this.state.showQR ? <ClearButton /> : undefined
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
                            iconContainerStyle={{
                                marginRight: 40
                            }}
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
