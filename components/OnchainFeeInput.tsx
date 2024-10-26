import React, { useEffect, useState } from 'react';
import { Text, TouchableWithoutFeedback, View } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

import TextInput from '../components/TextInput';
import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import stores from '../stores/Stores';
import LoadingIndicator from './LoadingIndicator';

interface OnchainFeeInputProps {
    navigation: StackNavigationProp<any, any>;
    fee?: string;
    onChangeFee: (fee: string) => void;
}

const DEFAULT_FEE = '10';

export default function OnchainFeeInput(props: OnchainFeeInputProps) {
    const { fee, onChangeFee, navigation } = props;

    const { settingsStore, feeStore } = stores;
    const { settings } = settingsStore;
    const enableMempoolRates = settings?.privacy?.enableMempoolRates;
    const preferredMempoolRate =
        settings?.payments?.preferredMempoolRate || 'fastestFee';

    const [newFee, setNewFee] = useState(fee);
    const [loading, setLoading] = useState(false);
    const [errorOccurredLoadingFees, setErrorOccurredLoadingFees] =
        useState(false);

    useEffect(() => setNewFee(fee), [fee]);

    useEffect(() => {
        if (enableMempoolRates) {
            setLoading(true);
            feeStore
                .getOnchainFeesviaMempool()
                .then((recommendedFees) => {
                    setNewFee(recommendedFees[preferredMempoolRate]);
                    onChangeFee(recommendedFees[preferredMempoolRate]);
                    setLoading(false);
                })
                .catch(() => {
                    onChangeFee('0');
                    setErrorOccurredLoadingFees(true);
                    setLoading(false);
                });
        }
    }, []);

    return (
        <>
            {enableMempoolRates ? (
                <TouchableWithoutFeedback
                    onPress={() =>
                        navigation.navigate('EditFee', {
                            onNavigateBack: (fee: string) => {
                                if (fee) {
                                    setErrorOccurredLoadingFees(false);
                                }
                                onChangeFee(fee);
                            },
                            fee: newFee
                        })
                    }
                >
                    <View
                        style={{
                            height: 55,
                            justifyContent: 'center',
                            marginTop: 15,
                            borderRadius: 4,
                            marginBottom: 20,
                            borderColor: 'rgba(255, 217, 63, .6)',
                            borderWidth: 3
                        }}
                    >
                        {loading ? (
                            <LoadingIndicator />
                        ) : (
                            <Text
                                style={{
                                    color: errorOccurredLoadingFees
                                        ? themeColor('warning')
                                        : themeColor('text'),
                                    paddingLeft: 15,
                                    fontSize: 18
                                }}
                            >
                                {errorOccurredLoadingFees
                                    ? localeString('views.EditFee.error')
                                    : newFee}
                            </Text>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            ) : (
                <TextInput
                    keyboardType="numeric"
                    placeholder={DEFAULT_FEE}
                    value={newFee}
                    onChangeText={(text: string) => {
                        setNewFee(text);
                        onChangeFee(text);
                    }}
                    error={!newFee || newFee === '0'}
                />
            )}
        </>
    );
}
