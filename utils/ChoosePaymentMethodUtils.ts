/**
 * Shared helpers for ChoosePaymentMethod, PaymentMethodList, and swipeable rows:
 * building payment-method rows, selectability checks, and navigation for a chosen row.
 */
import { Alert } from 'react-native';
import { getParams as getlnurlParams, LNURLWithdrawParams } from 'js-lnurl';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ReactNativeBlobUtil from 'react-native-blob-util';

import BackendUtils from './BackendUtils';
import { decodeNoffer, NofferPriceType } from './ClinkUtils';
import { localeString } from './LocaleUtils';
import { doTorRequest, RequestMethod } from './TorUtils';

import {
    cashuStore,
    invoicesStore,
    nodeInfoStore,
    settingsStore
} from '../stores/Stores';

export enum PaymentMethodLayer {
    Lightning = 'Lightning',
    LightningViaEcash = 'Lightning via ecash',
    LightningAddress = 'Lightning address',
    Offer = 'Offer',
    Clink = 'CLINK',
    OnChain = 'On-chain'
}

export type PaymentMethodListAccount = {
    name: string;
    balance: number;
    XFP?: string;
    watch_only?: boolean;
    hidden?: boolean;
};

/** Props needed to build list rows (no navigation / feeRate). */
export type PaymentMethodListRowsInput = {
    value?: string;
    lightning?: string;
    lightningAddress?: string;
    offer?: string;
    clinkNoffer?: string;
    lnurlParams?: LNURLWithdrawParams | undefined;
    lightningBalance?: number | string;
    onchainBalance?: number | string;
    ecashBalance?: number | string;
    accounts?: PaymentMethodListAccount[];
};

export type PaymentMethodListRow = {
    layer: string;
    subtitle?: string;
    disabled?: boolean;
    balance?: number | string;
    account?: string;
    hidden?: boolean;
    satAmount?: number;
};

export type PaymentMethodNavigationContext = {
    lightning?: string;
    lightningAddress?: string;
    offer?: string;
    clinkNoffer?: string;
    lnurlParams?: LNURLWithdrawParams;
    value?: string;
    satAmount?: number;
    feeRate?: string;
};

type StackNav = NativeStackNavigationProp<any, any>;

export function hasInsufficientBalance(
    balance: number | string | undefined,
    satAmount: number | undefined
): boolean {
    return (
        Number(balance) === 0 ||
        (satAmount !== undefined && satAmount > Number(balance))
    );
}

export function buildPaymentMethodListRows(
    props: PaymentMethodListRowsInput,
    satAmount: number | undefined
): PaymentMethodListRow[] {
    const {
        value,
        lightning,
        lightningAddress,
        offer,
        clinkNoffer,
        lnurlParams,
        lightningBalance,
        onchainBalance,
        ecashBalance,
        accounts
    } = props;
    const rows: PaymentMethodListRow[] = [];

    if (lightning || lnurlParams) {
        rows.push({
            layer: PaymentMethodLayer.Lightning,
            subtitle: lightning ?? lnurlParams?.tag,
            balance: lightningBalance,
            disabled: false,
            satAmount
        });

        if (
            BackendUtils.supportsCashuWallet() &&
            settingsStore?.settings?.ecash?.enableCashu
        ) {
            rows.push({
                layer: PaymentMethodLayer.LightningViaEcash,
                subtitle: lightning ?? lnurlParams?.tag,
                balance: ecashBalance,
                disabled: false,
                satAmount
            });
        }
    }

    if (lightningAddress) {
        rows.push({
            layer: PaymentMethodLayer.LightningAddress,
            subtitle: lightningAddress,
            balance: lightningBalance,
            disabled: false,
            satAmount
        });
    }

    if (offer) {
        rows.push({
            layer: PaymentMethodLayer.Offer,
            subtitle: offer,
            disabled: !nodeInfoStore.supportsOffers,
            balance: lightningBalance,
            satAmount
        });
    }

    if (value && BackendUtils.supportsOnchainReceiving()) {
        rows.push({
            layer: PaymentMethodLayer.OnChain,
            subtitle: value,
            disabled: !BackendUtils.supportsOnchainSends(),
            balance: onchainBalance,
            account: 'default',
            satAmount
        });

        if (accounts && accounts.length > 0) {
            accounts.forEach((account) => {
                if (!account.hidden && !account.watch_only) {
                    rows.push({
                        layer: account.name,
                        subtitle: value ?? account.XFP,
                        disabled: false,
                        balance: account.balance,
                        account: account.name,
                        hidden: account.hidden,
                        satAmount
                    });
                }
            });
        }
    }

    if (clinkNoffer) {
        let embeddedAmount: number | undefined;
        try {
            const decoded = decodeNoffer(clinkNoffer);
            if (
                decoded.priceType === NofferPriceType.Fixed &&
                typeof decoded.price === 'number' &&
                decoded.price > 0
            ) {
                embeddedAmount = decoded.price;
            }
        } catch {}
        const ecashAvailable =
            BackendUtils.supportsCashuWallet() &&
            settingsStore?.settings?.ecash?.enableCashu;
        const clinkBalance = Math.max(
            Number(lightningBalance ?? 0),
            ecashAvailable ? Number(ecashBalance ?? 0) : 0
        );
        rows.push({
            layer: PaymentMethodLayer.Clink,
            subtitle: clinkNoffer,
            disabled: clinkBalance === 0,
            ...(embeddedAmount !== undefined && {
                balance: clinkBalance,
                satAmount: embeddedAmount
            })
        });
    }
    return rows;
}

export function isPaymentMethodListRowSelectable(
    row: PaymentMethodListRow
): boolean {
    return !row.disabled && !hasInsufficientBalance(row.balance, row.satAmount);
}

// ─── Navigation (single implementation for list rows and auto-skip) ─────────

function go(
    navigation: StackNav,
    useReplace: boolean,
    name: string,
    params?: object
): void {
    if (useReplace) {
        navigation.replace(name, params);
    } else {
        navigation.navigate(name, params);
    }
}

async function handleLnurlRequest(
    lightning: string | undefined,
    lnurlParams: LNURLWithdrawParams | undefined,
    navigation: StackNav,
    useReplace: boolean,
    variant: 'lightning' | 'ecash'
): Promise<void> {
    const params: any = lnurlParams || (await getlnurlParams(lightning ?? ''));
    if (params?.status === 'ERROR' && params.domain?.endsWith('.onion')) {
        throw new Error(`${params.domain} says: ${params.reason}`);
    }
    switch (params.tag) {
        case 'payRequest':
            params.lnurlText = lightning;
            go(navigation, useReplace, 'LnurlPay', {
                lnurlParams: params,
                ecash:
                    variant === 'ecash'
                        ? true
                        : BackendUtils.supportsCashuWallet() &&
                          settingsStore.settings?.ecash?.enableCashu
            });
            break;
        case 'withdrawRequest':
            go(
                navigation,
                useReplace,
                variant === 'ecash' ? 'ReceiveEcash' : 'Receive',
                { lnurlParams: params }
            );
            break;
        default:
            Alert.alert(
                localeString('general.error'),
                params.status === 'ERROR'
                    ? `${params.domain} says: ${params.reason}`
                    : `${localeString(
                          'utils.handleAnything.unsupportedLnurlType'
                      )}: ${params.tag}`,
                [
                    {
                        text: localeString('general.ok'),
                        onPress: () => void 0
                    }
                ],
                { cancelable: false }
            );
    }
}

async function lightningLnAddress(
    lightningAddress: string,
    navigation: StackNav,
    useReplace: boolean
): Promise<void> {
    const [username, bolt11Domain] = lightningAddress.split('@');
    const url = bolt11Domain.includes('.onion')
        ? `http://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`
        : `https://${bolt11Domain}/.well-known/lnurlp/${username.toLowerCase()}`;

    const error = localeString('utils.handleAnything.lightningAddressError');
    const ecash =
        BackendUtils.supportsCashuWallet() &&
        settingsStore.settings?.ecash?.enableCashu;

    const onLnurlp = (data: { callback?: string }) => {
        if (!data.callback) {
            throw new Error(error);
        }
        go(navigation, useReplace, 'LnurlPay', {
            lnurlParams: data,
            ecash,
            lightningAddress
        });
    };

    if (settingsStore.enableTor && bolt11Domain.includes('.onion')) {
        const response = await doTorRequest(url, RequestMethod.GET);
        if (!response.callback) {
            throw new Error(error);
        }
        onLnurlp(response);
    } else {
        const response = await ReactNativeBlobUtil.fetch('get', url);
        if (response.info().status !== 200) {
            throw new Error(error);
        }
        onLnurlp(response.json());
    }
}

function navigateLightningRoute(
    ctx: PaymentMethodNavigationContext,
    navigation: StackNav,
    useReplace: boolean
): Promise<void> {
    const { lightning, lightningAddress, offer, lnurlParams } = ctx;

    if (offer) {
        go(navigation, useReplace, 'Send', {
            destination: offer,
            bolt12: offer,
            transactionType: 'BOLT 12',
            isValid: true
        });
        return Promise.resolve();
    }
    if (lightningAddress) {
        return lightningLnAddress(lightningAddress, navigation, useReplace);
    }
    if (lightning?.toLowerCase().startsWith('lnurl') || lnurlParams) {
        return handleLnurlRequest(
            lightning,
            lnurlParams,
            navigation,
            useReplace,
            'lightning'
        );
    }
    invoicesStore.getPayReq(lightning ?? '');
    go(navigation, useReplace, 'PaymentRequest', {});
    return Promise.resolve();
}

function navigateEcashRoute(
    ctx: PaymentMethodNavigationContext,
    navigation: StackNav,
    useReplace: boolean
): Promise<void> {
    const { lightning, lnurlParams } = ctx;
    if (lightning?.toLowerCase().startsWith('lnurl') || lnurlParams) {
        return handleLnurlRequest(
            lightning,
            lnurlParams,
            navigation,
            useReplace,
            'ecash'
        );
    }
    cashuStore.getPayReq(lightning ?? '');
    go(navigation, useReplace, 'CashuPaymentRequest', {});
    return Promise.resolve();
}

/**
 * Navigates to the payment flow screen for an already-selected payment list row.
 */
export async function navigateForSelectedPaymentRow(
    navigation: StackNav,
    row: PaymentMethodListRow,
    ctx: PaymentMethodNavigationContext,
    options: { replace: boolean }
): Promise<void> {
    const { replace } = options;

    if (
        row.layer === PaymentMethodLayer.Lightning ||
        row.layer === PaymentMethodLayer.Offer
    ) {
        await navigateLightningRoute(ctx, navigation, replace);
        return;
    }
    if (row.layer === PaymentMethodLayer.LightningAddress) {
        if (!ctx.lightningAddress) return;
        await lightningLnAddress(ctx.lightningAddress, navigation, replace);
        return;
    }
    if (row.layer === PaymentMethodLayer.LightningViaEcash) {
        await navigateEcashRoute(ctx, navigation, replace);
        return;
    }
    if (row.layer === PaymentMethodLayer.Clink) {
        if (!ctx.clinkNoffer) return;
        go(navigation, replace, 'ClinkPay', { noffer: ctx.clinkNoffer });
        return;
    }
    if (row.layer === PaymentMethodLayer.OnChain || row.account) {
        go(navigation, replace, 'Send', {
            destination: ctx.value,
            satAmount: ctx.satAmount,
            fee: ctx.feeRate,
            transactionType: PaymentMethodLayer.OnChain
        });
    }
}
