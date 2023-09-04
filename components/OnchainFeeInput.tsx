import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { themeColor } from '../utils/ThemeUtils';
import stores from '../stores/Stores';
import NavigationService from '../NavigationService';
import LoadingIndicator from './LoadingIndicator';

interface OnchainFeeInputProps {
    fee?: string;
    onChangeFee: (fee: string) => void;
}

export default function OnchainFeeInput(props: OnchainFeeInputProps) {
    const { fee, onChangeFee } = props;

    const { settingsStore, feeStore } = stores;
    const { settings } = settingsStore;
    const enableMempoolRates = settings?.privacy?.enableMempoolRates;

    const [newFee, setNewFee] = useState(fee);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setNewFee(fee);
    }, [fee]);

    useEffect(() => {
        if (enableMempoolRates) {
            setLoading(true);
            feeStore
                .getOnchainFeesviaMempool()
                .then((recommendedFees) => {
                    console.log('recommendedFees', recommendedFees);
                    setNewFee(recommendedFees.fastestFee);
                    setLoading(false);
                })
                .catch(() => {
                    setLoading(false);
                });
        }
    }, []);

    return (
        <>
            {enableMempoolRates ? (
                <TouchableWithoutFeedback
                    onPress={() =>
                        NavigationService.navigate('EditFee', {
                            onNavigateBack: onChangeFee
                        })
                    }
                >
                    <View
                        style={{
                            height: 65,
                            padding: loading ? 8 : 15,
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
                                    fontFamily: 'Lato-Regular',
                                    color: themeColor('text'),
                                    paddingBottom: 5,
                                    fontSize: 18
                                }}
                            >
                                {newFee}
                            </Text>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            ) : (
                <TextInput
                    keyboardType="numeric"
                    placeholder="2"
                    value={newFee}
                    onChangeText={(text: string) => {
                        setNewFee(text);
                        onChangeFee(text);
                    }}
                    style={{
                        paddingTop: 10,
                        paddingBottom: 10
                    }}
                />
            )}
        </>
    );
}
