import { StackNavigationProp } from '@react-navigation/stack';
import BackendUtils from './BackendUtils';
import AddressUtils from './AddressUtils';
import SettingsStore from '../stores/SettingsStore';
import TransactionsStore from '../stores/TransactionsStore';
import Invoice from '../models/Invoice';

class AutoPayUtils {
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
                throw new Error('Failed to decode Lightning invoice');
            }

            const invoiceModel = new Invoice(decodedInvoice);
            const amount = invoiceModel.getAmount;

            const { payments } = settingsStore.settings;
            const autoPayThreshold = payments?.autoPayThreshold || 0;

            if (
                payments?.autoPayEnabled &&
                amount > 0 &&
                amount <= autoPayThreshold
            ) {
                transactionsStore.sendPayment({
                    payment_request: invoice
                });

                const enableDonations = payments?.enableDonations || false;
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

    shouldTryAutoPay = (text: string): boolean => {
        return AddressUtils.isValidLightningPaymentRequest(text);
    };
}

const autoPayUtils = new AutoPayUtils();
export default autoPayUtils;
