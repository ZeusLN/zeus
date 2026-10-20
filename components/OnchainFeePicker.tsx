import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import LoadingIndicator from './LoadingIndicator';
import OutlinedButton from './OutlinedButton';
import SectionCard from './SectionCard';
import TextInput from './TextInput';

import { feeStore, modalStore, settingsStore } from '../stores/Stores';

import {
    FEE_PRESET_KEYS,
    FeePreset,
    isPlausibleSatPerVbyte,
    MAX_SAT_PER_VBYTE,
    MIN_SAT_PER_VBYTE,
    presetForFee
} from '../utils/FeeUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface OnchainFeePickerProps {
    fee?: string;
    onChangeFee: (fee: string) => void;
    title?: string;
}

// The same labels EditFee and the preferred rate setting use
const presetLabel = (preset: FeePreset) =>
    localeString(`views.EditFee.${preset}`);

function OnchainFeePicker({ fee, onChangeFee, title }: OnchainFeePickerProps) {
    const { settings } = settingsStore;
    const enableMempoolRates = settings?.privacy?.enableMempoolRates;
    const preferred = settings?.payments?.preferredMempoolRate || 'fastestFee';
    const { recommendedFees, loading, error } = feeStore;

    const [selected, setSelected] = useState<FeePreset | 'custom' | ''>('');
    const [customFee, setCustomFee] = useState('');
    // The last rate this picker reported, to tell a fee set from outside
    // (new route params on Send) apart from our own
    const reported = useRef(fee);
    const mounted = useRef(true);

    const report = (value: string) => {
        reported.current = value;
        onChangeFee(value);
    };

    // Shows a rate as the matching preset, or as a custom rate
    const show = (value: string, fees: { [key: string]: number }) => {
        const preset = presetForFee(value, fees, preferred);
        setSelected(preset);
        if (preset === 'custom') setCustomFee(value);
    };

    useEffect(() => {
        mounted.current = true;
        if (!enableMempoolRates) return;

        const given = fee && Number(fee) > 0 ? fee : '';
        feeStore
            .getOnchainFeesviaMempool()
            .then((fees: any) => {
                if (!mounted.current) return;
                if (!fees) {
                    // nothing to pick from, so ask for a rate
                    setSelected('custom');
                    setCustomFee(given);
                    report(given);
                    return;
                }
                const rate =
                    given || String(fees[preferred] ?? fees.fastestFee);
                show(rate, fees);
                if (rate !== fee) report(rate);
            })
            .catch(() => {
                if (!mounted.current) return;
                setSelected('custom');
                setCustomFee(given);
                report(given);
            });

        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!enableMempoolRates || fee === reported.current) return;
        reported.current = fee;
        if (!error && recommendedFees?.fastestFee !== undefined) {
            show(fee || '', recommendedFees);
        } else {
            setSelected('custom');
            setCustomFee(fee || '');
        }
    }, [fee]);

    const showInfo = () =>
        modalStore.toggleInfoModal({
            title: title || localeString('views.Send.feeSatsVbyte'),
            text: [
                localeString('components.OnchainFeePicker.info.rate'),
                ...(enableMempoolRates
                    ? [localeString('components.OnchainFeePicker.info.presets')]
                    : [])
            ]
        });

    const rateInput = (value: string, onChange: (text: string) => void) => (
        <>
            <TextInput
                keyboardType="numeric"
                placeholder={localeString(
                    'components.OnchainFeeInput.placeholder'
                )}
                value={value}
                onChangeText={onChange}
                error={!value || !isPlausibleSatPerVbyte(value)}
                style={{ backgroundColor: themeColor('background') }}
            />
            {!!value && !isPlausibleSatPerVbyte(value) && (
                <Text
                    style={{
                        ...styles.text,
                        color: themeColor('warning')
                    }}
                >
                    {localeString('views.EditFee.customFeeOutOfRange')
                        .replace('{min}', String(MIN_SAT_PER_VBYTE))
                        .replace('{max}', String(MAX_SAT_PER_VBYTE))}
                </Text>
            )}
        </>
    );

    return (
        <SectionCard
            title={title || localeString('views.Send.feeSatsVbyte')}
            onInfoPress={showInfo}
        >
            <View style={styles.body}>
                {!enableMempoolRates ? (
                    rateInput(fee || '', onChangeFee)
                ) : loading ? (
                    <LoadingIndicator />
                ) : (
                    <>
                        {error ? (
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('warning'),
                                    marginBottom: 10
                                }}
                            >
                                {localeString('views.EditFee.error')}
                            </Text>
                        ) : (
                            <View style={styles.presets}>
                                {FEE_PRESET_KEYS.filter(
                                    (key) => recommendedFees?.[key] != null
                                ).map((key) => (
                                    <OutlinedButton
                                        key={key}
                                        title={presetLabel(key)}
                                        value={String(recommendedFees[key])}
                                        selected={selected === key}
                                        onPress={() => {
                                            setSelected(key);
                                            report(
                                                String(recommendedFees[key])
                                            );
                                        }}
                                        style={styles.preset}
                                    />
                                ))}
                                <OutlinedButton
                                    title={localeString('general.custom')}
                                    selected={selected === 'custom'}
                                    onPress={() => {
                                        setSelected('custom');
                                        report(customFee);
                                    }}
                                    style={styles.preset}
                                />
                            </View>
                        )}
                        {selected === 'custom' &&
                            rateInput(customFee, (text: string) => {
                                setCustomFee(text);
                                report(text);
                            })}
                    </>
                )}
            </View>
        </SectionCard>
    );
}

export default observer(OnchainFeePicker);

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    body: {
        paddingTop: 15
    },
    presets: {
        flexDirection: 'row',
        flexWrap: 'wrap'
    },
    preset: {
        marginRight: 10,
        marginBottom: 10
    }
});
