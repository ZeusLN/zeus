import { StackNavigationProp } from '@react-navigation/stack';
import BackendUtils from './BackendUtils';
import AddressUtils from './AddressUtils';
import FeeUtils from './FeeUtils';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';
import CashuStore from '../stores/CashuStore';
import Invoice from '../models/Invoice';
import { localeString } from './LocaleUtils';

class AutoPayUtils {
    private static readonly DEFAULT_MAX_PARTS = '16';
    private static readonly DEFAULT_MAX_SHARD_AMT = '';
    private static readonly DEFAULT_TIMEOUT_SECONDS = '60';
    private static readonly DEFAULT_FEE_PERCENTAGE = '5.0';
    private static readonly DEFAULT_FALLBACK_FEE_LIMIT = '1000';
    private static readonly DEFAULT_FAILED_RESULT = {
        shouldAutoPay: false,
        amount: 0,
        enableDonations: false
    };

    private checkAutoPayConditions = async (
        invoice: string,
        settingsStore: SettingsStore,
        additionalCondition?: boolean
    ): Promise<{
        shouldAutoPay: boolean;
        amount: number;
        enableDonations: boolean;
    }> => {
        const decodedInvoice = await BackendUtils.decodePaymentRequest([
            invoice
        ]);

        if (!decodedInvoice) {
            throw new Error(
                localeString('views.LnurlPay.LnurlPay.invalidInvoice')
            );
        }

        const invoiceModel = new Invoice(decodedInvoice);
        const amount = invoiceModel.getRequestAmount;

        const { payments } = settingsStore.settings;
        const autoPayThreshold = payments?.autoPayThreshold || 0;
        const enableDonations = payments?.enableDonations || false;

        const shouldAutoPay = !!(
            payments?.autoPayEnabled &&
            amount > 0 &&
            amount <= autoPayThreshold &&
            additionalCondition !== false
        );

        return {
            shouldAutoPay,
            amount,
            enableDonations: enableDonations || false
        };
    };

    buildPaymentParams = async (
        invoice: string,
        amount: number,
        settingsStore: SettingsStore,
        pay_req?: any
    ) => {
        const { implementation } = settingsStore;
        const isLnd = BackendUtils.isLNDBased();
        const isCLightning = implementation === 'cln-rest';

        const maxParts = AutoPayUtils.DEFAULT_MAX_PARTS;
        const maxShardAmt = AutoPayUtils.DEFAULT_MAX_SHARD_AMT;
        const dynamicFeeLimitSat = FeeUtils.calculateDefaultRoutingFee(
            Number(amount)
        );

        const settings = await settingsStore.getSettings();
        const timeoutSeconds =
            settings?.payments?.timeoutSeconds ||
            AutoPayUtils.DEFAULT_TIMEOUT_SECONDS;
        const maxFeePercent =
            settings?.payments?.defaultFeePercentage ||
            AutoPayUtils.DEFAULT_FEE_PERCENTAGE;

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
            fee_limit_sat: isLnd
                ? dynamicFeeLimitSat.toString()
                : AutoPayUtils.DEFAULT_FALLBACK_FEE_LIMIT,
            max_fee_percent: isCLightning
                ? maxFeePercent.replace(/,/g, '.')
                : AutoPayUtils.DEFAULT_FEE_PERCENTAGE,
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
        navigation: StackNavigationProp<any, any>,
        screenName: string,
        enableDonations: boolean
    ): void => {
        navigation.navigate(screenName, { enableDonations });
    };

    checkAutoPayAndProcess = async (
        invoice: string,
        navigation: StackNavigationProp<any, any>,
        settingsStore: SettingsStore,
        transactionsStore: TransactionsStore
    ): Promise<boolean> => {
        try {
            const { shouldAutoPay, enableDonations, amount } =
                await this.checkAutoPayConditions(invoice, settingsStore);

            if (shouldAutoPay) {
                const paymentParams = await this.buildPaymentParams(
                    invoice,
                    amount,
                    settingsStore
                );

                await transactionsStore.sendPayment(paymentParams);
                this.navigateToSendingScreen(
                    navigation,
                    'SendingLightning',
                    enableDonations
                );
                return true;
            }

            return false;
        } catch (error) {
            this.handleError('Auto-pay error', error);
            return false;
        }
    };

    checkCashuAutoPayAndProcess = async (
        invoice: string,
        navigation: StackNavigationProp<any, any>,
        settingsStore: SettingsStore,
        cashuStore: CashuStore
    ): Promise<boolean> => {
        try {
            const hasPayReq = !!cashuStore.payReq;
            const { shouldAutoPay, enableDonations } =
                await this.checkAutoPayConditions(
                    invoice,
                    settingsStore,
                    hasPayReq
                );

            if (shouldAutoPay) {
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
            this.handleError('Cashu auto-pay error', error);
            return false;
        }
    };

    checkShouldAutoPay = async (
        invoice: string,
        settingsStore: SettingsStore,
        additionalCondition?: boolean
    ): Promise<{
        shouldAutoPay: boolean;
        amount: number;
        enableDonations: boolean;
    }> => {
        try {
            return await this.checkAutoPayConditions(
                invoice,
                settingsStore,
                additionalCondition
            );
        } catch (error) {
            this.handleError('Auto-pay conditions error', error);
            return AutoPayUtils.DEFAULT_FAILED_RESULT;
        }
    };

    shouldTryAutoPay = (text: string): boolean => {
        return AddressUtils.isValidLightningPaymentRequest(text);
    };
}

const autoPayUtils = new AutoPayUtils();
export default autoPayUtils;
