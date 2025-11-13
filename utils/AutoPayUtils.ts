import { StackNavigationProp } from '@react-navigation/stack';
import BackendUtils from './BackendUtils';
import AddressUtils from './AddressUtils';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';
import CashuStore from '../stores/CashuStore';
import Invoice from '../models/Invoice';

class AutoPayUtils {
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
            throw new Error('Failed to decode Lightning invoice');
        }

        const invoiceModel = new Invoice(decodedInvoice);
        const amount = invoiceModel.getAmount;

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

    checkAutoPayAndProcess = async (
        invoice: string,
        navigation: StackNavigationProp<any, any>,
        settingsStore: SettingsStore,
        transactionsStore: TransactionsStore
    ): Promise<boolean> => {
        try {
            const { shouldAutoPay, enableDonations } =
                await this.checkAutoPayConditions(invoice, settingsStore);

            if (shouldAutoPay) {
                transactionsStore.sendPayment({
                    payment_request: invoice
                });

                navigation.navigate('SendingLightning', {
                    enableDonations
                });
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking auto-pay:', error);
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
            const { shouldAutoPay, enableDonations } =
                await this.checkAutoPayConditions(
                    invoice,
                    settingsStore,
                    !!cashuStore.payReq
                );

            if (shouldAutoPay) {
                await cashuStore.payLnInvoiceFromEcash({});

                navigation.navigate('SendingLightning', {
                    enableDonations
                });
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking Cashu auto-pay:', error);
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
            console.error('Error checking auto-pay conditions:', error);
            return { shouldAutoPay: false, amount: 0, enableDonations: false };
        }
    };

    shouldTryAutoPay = (text: string): boolean => {
        return AddressUtils.isValidLightningPaymentRequest(text);
    };
}

const autoPayUtils = new AutoPayUtils();
export default autoPayUtils;
