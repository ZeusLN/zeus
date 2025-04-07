import React, { Component } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import AmountInput, { getSatAmount } from '../../components/AmountInput';
import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';
import TextInput from '../../components/TextInput';
import CollapsedQR from '../../components/CollapsedQR';
import Stores from '../../stores/Stores';
const ZIconWhite = require('../../assets/images/icon-white.png');
const ZIcon = require('../../assets/images/icon-black.png');

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils'
import { themeColor } from '../../utils/ThemeUtils';
import InvoicesStore from '../../stores/InvoicesStore';
import BalanceStore from '../../stores/BalanceStore';
import LoadingIndicator from '../../components/LoadingIndicator';
import { ErrorMessage } from '../../components/SuccessErrorMessage';

interface WithdrawalRequestProps {
    navigation: StackNavigationProp<any, any>;
    InvoicesStore: InvoicesStore;
    BalanceStore: BalanceStore;
}

interface WithdrawalRequestState {
    satsAmount: string;
    amount: string;
    description: string;
    bolt12: string;
    showQR: boolean;
    loading: boolean;
    error_msg: string | null
}

@inject('InvoicesStore', 'BalanceStore')
@observer
export default class WithdrawalRequest extends Component<
  WithdrawalRequestProps, 
  WithdrawalRequestState
> {
    constructor(props: WithdrawalRequestProps) {
        super(props);
        this.state = {
            satsAmount: '',
            amount: '',
            description: '',
            bolt12: '',
            showQR: false,
            loading: false,
            error_msg: null
        };
    }

    handleInputChange = (key: 'amount' | 'description', value: string) => {
        const { units } = Stores.unitsStore;
        const isBTC = units === 'BTC';

        this.setState((prevState) => ({
            ...prevState,
            [key]: value,
            satsAmount: isBTC ? getSatAmount(value).toString() : value,
        }));

        if (key === 'description') {
            this.props.InvoicesStore.clearUnified();
        }
    };    

    generateInvoice = async () => {
        const { description, satsAmount } = this.state;
        this.setState({ loading: true, error_msg: null });
      
        try {
            const response = await BackendUtils.invoicerequest({ amount: satsAmount, description });
            if (response && response.bolt12) {
                this.setState({
                    bolt12: response.bolt12,
                    showQR: true,
                    amount: '',
                    description: ''
                });
            } else {
                this.setState({ error_msg: localeString('views.withdrawal.errorCreate') });
            }
        } catch (error: any) {
            this.setState({
                error_msg: error.toString() || localeString(
                    'stores.InvoicesStore.errorCreatingInvoice'
                ),
                showQR: false
            });
        } finally {
            this.setState({ loading: false });
        }
    };

    render() {
        const { navigation, BalanceStore } = this.props;
        const { amount, description, bolt12, showQR, satsAmount } = this.state;
        const hasBalance = Number(BalanceStore.confirmedBlockchainBalance) > 0 || Number(BalanceStore.unconfirmedBlockchainBalance) > 0;
        const disabled = !description || !amount || !hasBalance;

        return (
            <Screen style={styles.screen}>
              <Header
                leftComponent="Back"
                centerComponent={{ text: localeString('views.Tools.withdrawal.title'), style: styles.headerText }}
                navigation={navigation}
              />
          
              {this.state.loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <LoadingIndicator />
                </View>
              ) : (
                <>
                  {this.state.error_msg ? <ErrorMessage message={this.state.error_msg} /> : null}
          
                  <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                    <Text style={styles.secondaryText}>
                      {localeString('views.Tools.withdrawal.description')}
                    </Text>
          
                    <TextInput
                      placeholder={localeString('views.Tools.withdrawal.descriptionPlaceholder')}
                      value={description}
                      onChangeText={(text: string) => this.handleInputChange('description', text)}
                    />
          
                    <View style={{ paddingBottom: 15 }}>
                      <Text style={styles.secondaryText}>
                        {localeString('views.Tools.withdrawal.amount')}
                      </Text>
                      <AmountInput amount={amount} onAmountChange={(value) => this.handleInputChange('amount', value)} />
                    </View>
          
                    <View style={styles.buttonContainer}>
                      <Button
                        title={localeString('views.Tools.withdrawal.createWithdrawalRequest')}
                        onPress={this.generateInvoice}
                        disabled={disabled}
                      />
                    </View>
          
                    {showQR && bolt12 ? (
                      <View style={{ paddingTop: 20 }}>
                        <CollapsedQR
                          value={bolt12 || ''}
                          iconOnly={true}
                          iconContainerStyle={{ marginRight: 20 }}
                          showShare={true}
                          expanded
                          textBottom
                          truncateLongValue
                          logo={themeColor('invertQrIcons') ? ZIconWhite : ZIcon}
                          satAmount={satsAmount}
                        />
                      </View>
                    ) : null}
                  </ScrollView>
                </>
              )}
            </Screen>
        );          
    }
}

const styles = StyleSheet.create({
    screen: {
        backgroundColor: '#121212',
    },
    headerText: {
        color: '#fff',
        fontFamily: 'PPNeueMontreal-Book'
    },
    secondaryText: {
        fontFamily: 'PPNeueMontreal-Book',
        color: '#bbb'
    },
    content: {
        padding: 20
    },
    buttonContainer: {
        alignItems: 'center',
        paddingTop: 10,
    },
});