import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BackendUtils from './BackendUtils';
import AddressUtils from './AddressUtils';
import FeeUtils from './FeeUtils';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';
import CashuStore from '../stores/CashuStore';
import Invoice from '../models/Invoice';
import { localeString } from './LocaleUtils';

interface DecodedPayReq {
    destination?: string;
    payment_hash?: string;
    num_satoshis?: number | string;
    timestamp?: number | string;
    expiry?: number | string;
    description?: string;
    description_hash?: string;
    fallback_addr?: string;
    cltv_expiry?: number | string;
    route_hints?: any[];
    payment_addr?: Uint8Array | string;
    num_msat?: number | string;
    features?: {
        [key: string]: {
            is_required?: boolean;
            name?: string;
            is_known?: boolean;
        };
    };
    blinded_paths?: any[];
    [key: string]: any;
}

class QuickPayUtils {
    private static readonly DEFAULT_MAX_PARTS = '16';
    private static readonly DEFAULT_MAX_SHARD_AMT = '';
    private static readonly DEFAULT_TIMEOUT_SECONDS = '60';
    private static readonly DEFAULT_FEE_PERCENTAGE = '5.0';
    private static readonly DEFAULT_FALLBACK_FEE_LIMIT = '1000';

    private checkQuickPayConditions = async (
        invoice: string,
        settingsStore: SettingsStore,
        additionalCondition?: boolean,
        pay_req?: DecodedPayReq
    ): Promise<{
        shouldQuickPay: boolean;
        amount: number;
        enableDonations: boolean;
    }> => {
        let invoiceModel: Invoice;

        if (pay_req) {
            invoiceModel =
                pay_req instanceof Invoice ? pay_req : new Invoice(pay_req);
        } else {
            const decodedInvoice = await BackendUtils.decodePaymentRequest([
                invoice
            ]);

            if (!decodedInvoice) {
                throw new Error(
                    localeString('views.LnurlPay.LnurlPay.invalidInvoice')
                );
            }

            invoiceModel = new Invoice(decodedInvoice);
        }

        const amount = invoiceModel.getRequestAmount;

        const { payments } = settingsStore.settings;
        const quickPayThreshold = payments?.quickPayThreshold || 0;
        const enableDonations = payments?.enableDonations || false;

        const shouldQuickPay = !!(
            payments?.quickPayEnabled &&
            amount > 0 &&
            amount <= quickPayThreshold &&
            additionalCondition !== false
        );

        return {
            shouldQuickPay,
            amount,
            enableDonations: enableDonations || false
        };
    };

    buildPaymentParams = async (
        invoice: string,
        amount: number,
        settingsStore: SettingsStore,
        pay_req?: DecodedPayReq
    ) => {
        const { implementation } = settingsStore;
        const isLnd = BackendUtils.isLNDBased();
        const isCLightning = implementation === 'cln-rest';

        const maxParts = QuickPayUtils.DEFAULT_MAX_PARTS;
        const maxShardAmt = QuickPayUtils.DEFAULT_MAX_SHARD_AMT;
        const dynamicFeeLimitSat = FeeUtils.calculateDefaultRoutingFee(
            Number(amount)
        );

        const settings = await settingsStore.getSettings();
        const timeoutSeconds =
            settings?.payments?.timeoutSeconds ||
            QuickPayUtils.DEFAULT_TIMEOUT_SECONDS;
        const maxFeePercent =
            settings?.payments?.defaultFeePercentage ||
            QuickPayUtils.DEFAULT_FEE_PERCENTAGE;

        let enableAmp = false;
        if (
            pay_req &&
            pay_req.features &&
            pay_req.features['30'] &&
            pay_req.features['30'].is_required
        ) {
            enableAmp = true;
        }

        return {
            payment_request: invoice,
            max_parts: maxParts,
            max_shard_amt: maxShardAmt,
            // LND calculates fees dynamically, others use fixed fallback
            fee_limit_sat: isLnd
                ? dynamicFeeLimitSat.toString()
                : QuickPayUtils.DEFAULT_FALLBACK_FEE_LIMIT,
            // CLN needs comma-to-period conversion for decimal separator
            max_fee_percent: isCLightning
                ? maxFeePercent.replace(/,/g, '.')
                : QuickPayUtils.DEFAULT_FEE_PERCENTAGE,
            outgoing_chan_id: '',
            last_hop_pubkey: '',
            amp: enableAmp,
            timeout_seconds: timeoutSeconds
        };
    };

    private handleError = (context: string, error: any): void => {
        console.error(`${context}:`, error);
    };

    private navigateToSendingScreen = (
        navigation: NativeStackNavigationProp<any, any>,
        screenName: string,
        enableDonations: boolean
    ): void => {
        navigation.navigate(screenName, { enableDonations });
    };

    private executeQuickPay = async (
        invoice: string,
        settingsStore: SettingsStore,
        transactionsStore: TransactionsStore,
        pay_req?: DecodedPayReq
    ): Promise<{
        success: boolean;
        enableDonations: boolean;
    }> => {
        const { shouldQuickPay, enableDonations, amount } =
            await this.checkQuickPayConditions(
                invoice,
                settingsStore,
                undefined,
                pay_req
            );

        if (!shouldQuickPay) {
            return { success: false, enableDonations };
        }

        const paymentParams = await this.buildPaymentParams(
            invoice,
            amount,
            settingsStore,
            pay_req
        );

        await transactionsStore.sendPayment(paymentParams);
        return { success: true, enableDonations };
    };

    checkQuickPayAndProcess = async (
        invoice: string,
        navigation: NativeStackNavigationProp<any, any>,
        settingsStore: SettingsStore,
        transactionsStore: TransactionsStore
    ): Promise<boolean> => {
        try {
            const { success, enableDonations } = await this.executeQuickPay(
                invoice,
                settingsStore,
                transactionsStore
            );

            if (success) {
                this.navigateToSendingScreen(
                    navigation,
                    'SendingLightning',
                    enableDonations
                );
                return true;
            }

            return false;
        } catch (error) {
            this.handleError('Quick-pay error', error);
            return false;
        }
    };

    checkQuickPayAndReturnRoute = async (
        invoice: string,
        settingsStore: SettingsStore,
        transactionsStore: TransactionsStore,
        pay_req?: DecodedPayReq
    ): Promise<[string, any]> => {
        if (!this.shouldTryQuickPay(invoice)) {
            return ['PaymentRequest', {}];
        }

        try {
            const { success, enableDonations } = await this.executeQuickPay(
                invoice,
                settingsStore,
                transactionsStore,
                pay_req
            );

            if (success) {
                return [
                    'SendingLightning',
                    {
                        enableDonations
                    }
                ];
            }

            return ['PaymentRequest', {}];
        } catch (error) {
            this.handleError('Quick-pay check failed', error);
            return ['PaymentRequest', {}];
        }
    };

    checkCashuQuickPayAndProcess = async (
        invoice: string,
        navigation: NativeStackNavigationProp<any, any>,
        settingsStore: SettingsStore,
        cashuStore: CashuStore
    ): Promise<boolean> => {
        try {
            const hasPayReq = !!cashuStore.payReq;
            const { shouldQuickPay, enableDonations } =
                await this.checkQuickPayConditions(
                    invoice,
                    settingsStore,
                    hasPayReq
                );

            if (shouldQuickPay) {
                await cashuStore.payLnInvoiceFromEcash({});
                this.navigateToSendingScreen(
                    navigation,
                    'CashuSendingLightning',
                    enableDonations
                );
                return true;
            }

            return false;
        } catch (error) {
            this.handleError('Cashu quick-pay error', error);
            return false;
        }
    };

    shouldTryQuickPay = (text: string): boolean => {
        return AddressUtils.isValidLightningPaymentRequest(text);
    };
}

const quickPayUtils = new QuickPayUtils();
export default quickPayUtils;
