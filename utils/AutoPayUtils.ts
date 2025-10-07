import { StackNavigationProp } from '@react-navigation/stack';
import BackendUtils from './BackendUtils';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';

class AutoPayUtils {
    getAmountFromDecodedInvoice = (decodedInvoice: any): number => {
        if (!decodedInvoice) {
            return 0;
        }
        if (decodedInvoice.num_satoshis) {
            return Number(decodedInvoice.num_satoshis);
        }
        if (decodedInvoice.num_msat) {
            return Math.floor(Number(decodedInvoice.num_msat) / 1000);
        }
        if (decodedInvoice.numSatoshis) {
            return Number(decodedInvoice.numSatoshis);
        }
        if (decodedInvoice.numMsat) {
            return Math.floor(Number(decodedInvoice.numMsat) / 1000);
        }
        if (decodedInvoice.amount_msat) {
            return Math.floor(Number(decodedInvoice.amount_msat) / 1000);
        }
        if (decodedInvoice.amount) {
            return Number(decodedInvoice.amount);
        }
        if (decodedInvoice.value) {
            return Number(decodedInvoice.value);
        }
        if (decodedInvoice.valueSat) {
            return Number(decodedInvoice.valueSat);
        }
        if (decodedInvoice.valueMsat) {
            return Math.floor(Number(decodedInvoice.valueMsat) / 1000);
        }
        return 0;
    };

    checkAutoPayAndProcess = async (
        invoice: string,
        navigation: StackNavigationProp<any, any>,
        settingsStore: SettingsStore,
        transactionsStore: TransactionsStore
    ): Promise<boolean> => {
        try {
            const decodedInvoice = await BackendUtils.decodePaymentRequest([
                invoice
            ]);

            if (!decodedInvoice) {
                return false;
            }

            const amount = this.getAmountFromDecodedInvoice(decodedInvoice);
            const autoPayThreshold =
                settingsStore.settings?.payments?.autoPayThreshold || 0;

            if (
                settingsStore.settings?.payments?.autoPayEnabled &&
                amount > 0 &&
                amount <= autoPayThreshold
            ) {
                transactionsStore.sendPayment({
                    payment_request: invoice
                });

                navigation.navigate('SendingLightning', {
                    enableDonations: false
                });
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking auto-pay:', error);
            return false;
        }
    };

    shouldTryAutoPay = (text: string): boolean => {
        if (!text || typeof text !== 'string') {
            return false;
        }
        const trimmed = text.trim();
        return (
            trimmed.toLowerCase().startsWith('lnbc') ||
            trimmed.toLowerCase().startsWith('lnbcrt') ||
            trimmed.toLowerCase().startsWith('lntb')
        );
    };
}

const autoPayUtils = new AutoPayUtils();
export default autoPayUtils;
