import React, { Component, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    I18nManager
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RectButton } from 'react-native-gesture-handler';
import { StackNavigationProp } from '@react-navigation/stack';
import BigNumber from 'bignumber.js';

import { inject, observer } from 'mobx-react';
import Amount from '../Amount';
import Button from '../Button';
import { Spacer } from '../layout/Spacer';
import LightningSwipeableRow from './LightningSwipeableRow';
import OnchainSwipeableRow from './OnchainSwipeableRow';
import EcashSwipeableRow from './EcashSwipeableRow';
import { Row as LayoutRow } from '../layout/Row';
import Pill from '../Pill';

import { cashuStore, utxosStore } from '../../stores/Stores';

import BalanceStore from '../../stores/BalanceStore';
import CashuStore from '../../stores/CashuStore';
import UnitsStore from '../../stores/UnitsStore';
import UTXOsStore from '../../stores/UTXOsStore';
import SettingsStore from '../../stores/SettingsStore';
import LSPStore from '../../stores/LSPStore';
import SwapStore from '../../stores/SwapStore';
import InvoicesStore from '../../stores/InvoicesStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { blendHexColors, themeColor } from '../../utils/ThemeUtils';

import EyeClosed from '../../assets/images/SVG/eye_closed.svg';
import EyeOpened from '../../assets/images/SVG/eye_opened.svg';
import EcashSvg from '../../assets/images/SVG/DynamicSVG/EcashSvg';
import OnChainSvg from '../../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
import MatiSvg from '../../assets/images/SVG/DynamicSVG/MatiSvg';

interface LayerBalancesProps {
    BalanceStore?: BalanceStore;
    CashuStore?: CashuStore;
    SettingsStore?: SettingsStore;
    UTXOsStore?: UTXOsStore;
    UnitsStore?: UnitsStore;
    LSPStore?: LSPStore;
    SwapStore?: SwapStore;
    InvoicesStore?: InvoicesStore;
    navigation: StackNavigationProp<any, any>;
    onRefresh?: any;
    value?: string;
    satAmount?: string;
    lightning?: string;
    offer?: string;
    locked?: boolean;
    consolidated?: boolean;
    editMode?: boolean;
    needsConfig?: boolean;
    refreshing?: boolean;
}

//  To toggle LTR/RTL change to `true`
I18nManager.allowRTL(false);

type DataRow = {
    layer: string;
    subtitle?: string;
    balance: string | number;
    // TODO check if exists
    count?: number;
    watchOnly?: boolean;
    custodial?: boolean;
    needsConfig?: boolean;
    hidden?: boolean;
};

const getEcashRowColors = () => {
    try {
        // Ensure cashuStore and totalBalanceSats are available
        if (
            !cashuStore ||
            cashuStore.totalBalanceSats === undefined ||
            cashuStore.totalBalanceSats === null
        ) {
            console.warn(
                'getEcashRowColors: Cashu store or totalBalanceSats not available.'
            );
            return false;
        }

        const balanceSats = new BigNumber(cashuStore.totalBalanceSats);

        // Check if balanceSats is a valid number
        if (balanceSats.isNaN()) {
            console.warn(
                'getEcashRowColors: Invalid balanceSats value:',
                cashuStore.totalBalanceSats
            );
            return false;
        }

        const ratio = balanceSats.div(100_000).toNumber();
        const buttonBg =
            themeColor('buttonBackground') ||
            themeColor('buttonGradient') ||
            themeColor('secondary');
        const warningColor = themeColor('warning');
        const errorColor = themeColor('error');

        // Ensure theme colors are valid
        if (!buttonBg || !warningColor || !errorColor) {
            console.warn('getEcashRowColors: Theme color missing.');
            return false;
        }

        const blend = blendHexColors(buttonBg, warningColor, ratio);

        if (balanceSats.gte(10_000)) {
            return [blend, errorColor];
        } else {
            return false;
        }
    } catch (error) {
        console.error('Error calculating Ecash row colors:', error);
        return false; // Return default value in case of any error
    }
};

const Row = ({ item }: { item: DataRow }) => {
    const moreAccounts =
        item.layer === localeString('components.LayerBalances.moreAccounts');
    const ecashRowColors = getEcashRowColors();
    return (
        <RectButton>
            <LinearGradient
                colors={
                    item.layer === 'Ecash' && ecashRowColors
                        ? ecashRowColors
                        : themeColor('buttonGradient')
                        ? themeColor('buttonGradient')
                        : themeColor('buttonBackground')
                        ? [
                              themeColor('buttonBackground'),
                              themeColor('buttonBackground')
                          ]
                        : [themeColor('secondary'), themeColor('secondary')]
                }
                style={
                    moreAccounts
                        ? {
                              ...styles.rectButton,
                              height: 40
                          }
                        : styles.rectButton
                }
            >
                <View style={styles.left}>
                    {item.watchOnly ? (
                        <MatiSvg />
                    ) : item.layer === 'Ecash' ? (
                        <EcashSvg />
                    ) : item.layer === 'On-chain' ? (
                        <OnChainSvg />
                    ) : item.layer === 'Lightning' ? (
                        <LightningSvg />
                    ) : moreAccounts ? null : (
                        <OnChainSvg />
                    )}
                    <Spacer width={5} />
                    <View
                        style={{
                            flexDirection: 'column',
                            left: moreAccounts ? 5 : 0
                        }}
                    >
                        <Text
                            style={{
                                ...styles.layerText,
                                color:
                                    themeColor('buttonText') ||
                                    themeColor('text')
                            }}
                        >
                            {item.layer === 'Lightning'
                                ? localeString('general.lightning')
                                : item.layer === 'On-chain'
                                ? localeString('general.onchain')
                                : item.layer}
                        </Text>
                        {item.subtitle && (
                            <Text
                                style={{
                                    ...styles.layerText,
                                    color:
                                        themeColor('buttonTextSecondary') ||
                                        themeColor('secondaryText')
                                }}
                            >
                                {item.subtitle}
                            </Text>
                        )}
                        {item.custodial && !item.needsConfig && (
                            <View style={{ marginTop: 5 }}>
                                <Pill
                                    title={localeString(
                                        'general.custodialWallet'
                                    ).toUpperCase()}
                                    textColor={themeColor('highlight')}
                                    width={160}
                                    height={25}
                                />
                            </View>
                        )}
                        {item.needsConfig && (
                            <View style={{ marginTop: 5 }}>
                                <Pill
                                    title={localeString(
                                        'cashu.tapToConfigure'
                                    ).toUpperCase()}
                                    textColor={themeColor('highlight')}
                                    borderColor={themeColor('highlight')}
                                    width={'110%'}
                                    height={25}
                                />
                            </View>
                        )}
                    </View>
                </View>

                {!moreAccounts ? (
                    <>
                        {!item.needsConfig && (
                            <Amount
                                sats={item.balance}
                                sensitive
                                colorOverride={themeColor('buttonText')}
                            />
                        )}
                    </>
                ) : (
                    <Text
                        style={{
                            ...styles.layerText,
                            color: themeColor('buttonText')
                        }}
                    >
                        {item.count && `+${item.count - 1}`}
                    </Text>
                )}
            </LinearGradient>
        </RectButton>
    );
};

const SwipeableRow = ({
    item,
    index,
    navigation,
    value,
    satAmount,
    lightning,
    offer,
    locked,
    editMode
}: {
    item: DataRow;
    index: number;
    navigation: StackNavigationProp<any, any>;
    value?: string;
    satAmount?: string;
    lightning?: string;
    offer?: string;
    locked?: boolean;
    editMode?: boolean;
}) => {
    if (index === 0) {
        return (
            <LightningSwipeableRow
                navigation={navigation}
                lightning={lightning}
                offer={offer}
                locked={locked}
            >
                <Row item={item} />
            </LightningSwipeableRow>
        );
    }

    if (index === 1) {
        return (
            <OnchainSwipeableRow
                navigation={navigation}
                value={value}
                satAmount={satAmount}
                locked={locked}
            >
                <Row item={item} />
            </OnchainSwipeableRow>
        );
    }

    if (item.layer === 'Ecash') {
        return (
            <EcashSwipeableRow
                navigation={navigation}
                value={value}
                locked={locked}
                needsConfig={cashuStore.mintUrls.length === 0}
            >
                <Row item={item} />
            </EcashSwipeableRow>
        );
    }

    if (item.layer === localeString('components.LayerBalances.moreAccounts')) {
        return (
            <TouchableOpacity onPress={() => navigation.navigate('Accounts')}>
                <Row item={item} />
            </TouchableOpacity>
        );
    }

    const HideButton = () => (
        <TouchableOpacity
            onPress={() => {
                item.hidden
                    ? utxosStore.unhideAccount(item.layer)
                    : utxosStore.hideAccount(item.layer);
            }}
        >
            {item.hidden ? (
                <EyeClosed
                    style={styles.eyeIcon}
                    fill={themeColor('text')}
                    height={30}
                    width={30}
                />
            ) : (
                <EyeOpened
                    style={styles.eyeIcon}
                    fill={themeColor('text')}
                    height={30}
                    width={30}
                />
            )}
        </TouchableOpacity>
    );

    return (
        <LayoutRow>
            {editMode && <HideButton />}
            <OnchainSwipeableRow
                navigation={navigation}
                value={value}
                satAmount={satAmount}
                locked={locked}
                account={item.layer}
                hidden={item.hidden}
            >
                <Row item={item} />
            </OnchainSwipeableRow>
        </LayoutRow>
    );
};

const LayerBalancesWrapper = (props: LayerBalancesProps) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {
        BalanceStore,
        CashuStore,
        SettingsStore,
        LSPStore,
        SwapStore,
        InvoicesStore,
        navigation,
        value,
        satAmount,
        lightning,
        offer,
        onRefresh,
        locked,
        consolidated,
        editMode,
        refreshing
    } = props;

    const { settings } = SettingsStore!;
    const { totalBlockchainBalance, lightningBalance } = BalanceStore!;
    const { totalBalanceSats: cashuTotalBalanceSats, mintUrls } = CashuStore!;

    const handleMoveFundsToLn = async () => {
        setLoading(true);
        setError(null);

        try {
            if (!SwapStore?.reverseInfo || SwapStore?.loading) {
                await SwapStore?.getSwapFees();
                if (!SwapStore?.reverseInfo) {
                    throw new Error(
                        'Swap service information not available. Please try again.'
                    );
                }
            }

            if (!LSPStore?.info || !LSPStore?.info.pubkey) {
                await LSPStore?.getLSPInfo();
                if (!LSPStore?.info || !LSPStore?.info.pubkey) {
                    throw new Error('LSP information not available.');
                }
            }

            const totalOnchainSatsBn = new BigNumber(totalBlockchainBalance);
            if (totalOnchainSatsBn.isLessThanOrEqualTo(0)) {
                throw new Error('No on-chain balance to transfer.');
            }

            const { reverseInfo }: { reverseInfo: any } = SwapStore;

            // Calculate swap fees
            const swapServiceFeePct = new BigNumber(
                reverseInfo?.fees?.percentage
            ).div(100);
            const swapMinerFeeSats = new BigNumber(
                reverseInfo?.fees?.minerFees?.claim || 0
            ).plus(reverseInfo?.fees?.minerFees?.lockup || 0);

            // Amount available for LN after swap fees
            const serviceFeeForSwap = totalOnchainSatsBn
                .times(swapServiceFeePct)
                .integerValue(BigNumber.ROUND_CEIL);
            let amountPostSwapSats = totalOnchainSatsBn
                .minus(serviceFeeForSwap)
                .minus(swapMinerFeeSats);

            if (amountPostSwapSats.isLessThanOrEqualTo(0)) {
                throw new Error(
                    `Insufficient funds to cover swap fees. Required: > ${serviceFeeForSwap
                        .plus(swapMinerFeeSats)
                        .toString()} sats. Available: ${totalOnchainSatsBn.toString()} sats.`
                );
            }

            // Get LSP fee for this amount
            const amountPostSwapMsats = amountPostSwapSats
                .times(1000)
                .toNumber();
            const lspFeeMsatsRaw = await LSPStore.getZeroConfFee(
                amountPostSwapMsats
            );

            if (LSPStore.flow_error || typeof lspFeeMsatsRaw === 'undefined') {
                throw new Error(
                    `LSP Error getting fee: ${
                        LSPStore.flow_error_msg ||
                        'Fee could not be determined.'
                    }`
                );
            }
            const lspFeeSats = new BigNumber(lspFeeMsatsRaw)
                .div(1000)
                .integerValue(BigNumber.ROUND_CEIL);

            // Final amount for the user's Lightning node invoice (after swap and LSP fees)
            const finalInvoiceAmountForUserNodeSats =
                amountPostSwapSats.minus(lspFeeSats);

            if (finalInvoiceAmountForUserNodeSats.isLessThanOrEqualTo(0)) {
                throw new Error(
                    `Insufficient funds to cover LSP fee (${lspFeeSats.toString()} sats) after swap. Amount after swap: ${amountPostSwapSats.toString()} sats. Total on-chain: ${totalOnchainSatsBn.toString()} sats.`
                );
            }

            // Create an internal invoice for the final amount
            await InvoicesStore?.createUnifiedInvoice({
                memo: '', // memo must be empty for wrapped invoices
                value: finalInvoiceAmountForUserNodeSats.toString(),
                expiry: settings.invoices?.expirySeconds || '3600'
            });
            const userGeneratedBolt11 = InvoicesStore?.payment_request;

            if (!userGeneratedBolt11) {
                throw new Error(
                    'Failed to generate internal Lightning invoice for LSP.'
                );
            }

            // Get JIT invoice from LSP to pay our internal invoice
            const jitBolt11 = await LSPStore.getZeroConfInvoice(
                userGeneratedBolt11
            );

            if (LSPStore.flow_error || !jitBolt11) {
                throw new Error(
                    `LSP Error creating JIT invoice: ${
                        LSPStore.flow_error_msg || 'JIT invoice not received.'
                    }`
                );
            }

            // Navigate to Swaps screen
            navigation.navigate('Swaps', {
                initialInvoice: jitBolt11, // This is the LSP's invoice we need to pay on-chain
                initialAmountSats: totalOnchainSatsBn.toNumber(), // This is the total on-chain amount we are sending
                initialReverse: true,
                isJitInvoiceForOutput: true // Indicate that initialInvoice's amount is the target output
            });
        } catch (e: any) {
            setError(
                e.message ||
                    'An unknown error occurred while preparing the transfer.'
            );
        } finally {
            setLoading(false);
        }
    };

    const otherAccounts = editMode
        ? utxosStore?.accounts
        : utxosStore?.accounts.filter((item: any) => !item.hidden);

    let DATA: DataRow[] = [
        {
            layer: 'Lightning',
            balance: Number(lightningBalance).toFixed(3)
        }
    ];

    if (BackendUtils.supportsOnchainReceiving()) {
        DATA.push({
            layer: 'On-chain',
            balance: Number(totalBlockchainBalance).toFixed(3)
        });
    }

    if (BackendUtils.supportsCashuWallet() && settings?.ecash?.enableCashu) {
        DATA.push({
            layer: 'Ecash',
            custodial: true,
            needsConfig: mintUrls?.length === 0,
            balance: Number(cashuTotalBalanceSats).toFixed(3) // Use renamed var
        });
    }

    if (Object.keys(otherAccounts).length > 0 && !consolidated) {
        for (let i = 0; i < otherAccounts.length; i++) {
            if (!editMode && otherAccounts[i].hidden) i++;
            DATA.push({
                layer: otherAccounts[i].name,
                subtitle: otherAccounts[i].XFP,
                balance: otherAccounts[i].balance || 0,
                watchOnly: otherAccounts[i].watch_only || false,
                hidden: otherAccounts[i].hidden || false
            });
        }
    }

    if (Object.keys(otherAccounts).length > 0 && consolidated) {
        let n = 0;
        for (let i = 0; i < otherAccounts.length; i++) {
            while (n < 1) {
                DATA.push({
                    layer: otherAccounts[i].name,
                    subtitle: otherAccounts[i].XFP,
                    balance: otherAccounts[i].balance || 0,
                    watchOnly: otherAccounts[i].watch_only || false,
                    hidden: otherAccounts[i].hidden || false
                });
                n++;
            }
        }
    }

    if (Object.keys(otherAccounts).length > 1 && consolidated) {
        DATA.push({
            layer: localeString('components.LayerBalances.moreAccounts'),
            count: Object.keys(otherAccounts).length,
            balance: 0
        });
    }

    return (
        <View style={{ flex: 1 }}>
            {error && (
                <View style={{ paddingHorizontal: 15, paddingVertical: 10 }}>
                    <Text
                        style={{
                            color: themeColor('error'),
                            textAlign: 'center'
                        }}
                    >
                        {error}
                    </Text>
                </View>
            )}
            {lightningBalance === 0 &&
                Number(totalBlockchainBalance) > 0 &&
                BackendUtils.supportsFlowLSP() &&
                BackendUtils.supportsOnchainSends() && (
                    <View
                        style={{
                            marginHorizontal: 15,
                            marginBottom: DATA.length > 0 ? 20 : 0
                        }}
                    >
                        <Button
                            title={
                                loading
                                    ? localeString('general.processing')
                                    : localeString(
                                          'components.LayerBalances.moveFundsToLn'
                                      )
                            }
                            onPress={handleMoveFundsToLn}
                            secondary
                            disabled={loading || totalBlockchainBalance === 0}
                        />
                    </View>
                )}
            <FlatList
                data={DATA}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item, index }) => (
                    <SwipeableRow
                        item={item}
                        index={index}
                        navigation={navigation}
                        // select pay method vars
                        value={value}
                        satAmount={satAmount}
                        lightning={lightning}
                        offer={offer}
                        locked={locked || editMode}
                        editMode={editMode}
                    />
                )}
                keyExtractor={(_item, index) => `message ${index}`}
                style={{ marginTop: 20 }}
                onRefresh={() => onRefresh()}
                refreshing={refreshing ? refreshing : false}
            />
        </View>
    );
};

@inject(
    'BalanceStore',
    'CashuStore',
    'UTXOsStore',
    'SettingsStore',
    'LSPStore',
    'SwapStore',
    'InvoicesStore'
)
@observer
export default class LayerBalances extends Component<LayerBalancesProps, {}> {
    render() {
        return <LayerBalancesWrapper {...this.props} />;
    }
}

const styles = StyleSheet.create({
    rectButton: {
        flex: 1,
        height: 80,
        paddingVertical: 10,
        paddingLeft: 6,
        paddingRight: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: 'row',
        marginLeft: 15,
        marginRight: 15,
        borderRadius: 50
    },
    moreButton: {
        height: 40,
        paddingVertical: 10,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: 'row',
        marginLeft: 15,
        marginRight: 15,
        borderRadius: 15
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start'
    },
    separator: {
        backgroundColor: 'transparent',
        height: 20
    },
    layerText: {
        backgroundColor: 'transparent',
        fontSize: 15,
        fontFamily: 'PPNeueMontreal-Medium'
    },
    eyeIcon: { alignSelf: 'center', margin: 15, marginLeft: 25 }
});
