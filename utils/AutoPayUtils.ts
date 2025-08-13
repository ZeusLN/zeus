import { Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import BackendUtils from './BackendUtils';
import { localeString } from './LocaleUtils';
import Contact from '../models/Contact';
import { autoPayStore, settingsStore } from '../stores/Stores';

export interface AutoPayInvoice {
    invoice: string;
    amount: number;
    isValid: boolean;
    payment_hash?: string;
    expiry?: number;
    contact?: Contact;
    autoPayEnabled?: boolean;
    withinThreshold?: boolean;
}

class AutoPayUtils {
    private isProcessingInvoice: boolean = false;
    private lastProcessedPaymentHash: string = '';
    private lastProcessedTime: number = 0;
    private lastClipboardContent: string = '';
    private clipboardCheckTime: number = 0;
    private readonly PROCESSING_TIMEOUT = 30000; // 30 seconds
    private readonly CLIPBOARD_RECHECK_TIMEOUT = 60000; // 60 seconds

    public setProcessingFlag = (paymentHash: string, isProcessing: boolean) => {
        this.isProcessingInvoice = isProcessing;
        if (isProcessing) {
            this.lastProcessedPaymentHash = paymentHash;
            this.lastProcessedTime = Date.now();
        }
    };

    public isCurrentlyProcessing = (paymentHash: string): boolean => {
        const now = Date.now();

        if (
            this.lastProcessedTime > 0 &&
            now - this.lastProcessedTime > this.PROCESSING_TIMEOUT
        ) {
            this.clearProcessingInvoice();
        }

        return (
            this.isProcessingInvoice ||
            (this.lastProcessedPaymentHash === paymentHash &&
                now - this.lastProcessedTime < this.PROCESSING_TIMEOUT)
        );
    };

    private shouldCheckClipboard = (
        clipboardContent: string,
        forceCheck: boolean = false
    ): boolean => {
        const now = Date.now();

        if (forceCheck) {
            this.lastClipboardContent = clipboardContent;
            this.clipboardCheckTime = now;
            return true;
        }

        if (clipboardContent !== this.lastClipboardContent) {
            this.lastClipboardContent = clipboardContent;
            this.clipboardCheckTime = now;
            return true;
        }

        if (now - this.clipboardCheckTime > this.CLIPBOARD_RECHECK_TIMEOUT) {
            this.clipboardCheckTime = now;
            return true;
        }

        return false;
    };

    public clearProcessingInvoice = () => {
        this.isProcessingInvoice = false;
        this.lastProcessedPaymentHash = '';
        this.lastProcessedTime = 0;
    };

    public clearClipboardCache = () => {
        this.lastClipboardContent = '';
        this.clipboardCheckTime = 0;
    };

    public findContactForInvoice = async (
        invoice: string,
        contacts: Contact[]
    ): Promise<Contact | null> => {
        try {
            const decodedInvoice = await BackendUtils.decodePaymentRequest([
                invoice
            ]);

            if (!decodedInvoice) {
                return null;
            }

            const destination = decodedInvoice.destination;
            const description = decodedInvoice.description || '';

            if (destination) {
                const contactByPubkey = contacts.find((contact) => {
                    const hasMatch = contact.pubkey?.includes(destination);
                    return hasMatch;
                });
                if (contactByPubkey) {
                    return contactByPubkey;
                }
            }

            const lnAddressMatch = description.match(
                /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
            );
            if (lnAddressMatch) {
                const lnAddress = lnAddressMatch[1];
                const contactByLnAddress = contacts.find((contact) => {
                    const hasMatch = contact.lnAddress?.includes(lnAddress);

                    return hasMatch;
                });
                if (contactByLnAddress) {
                    return contactByLnAddress;
                }
            }

            return null;
        } catch (error) {
            console.error('Error finding contact for invoice:', error);
            return null;
        }
    };

    public validateAutoPayRules = (
        contact: Contact,
        amount: number
    ): {
        autoPayEnabled: boolean;
        withinThreshold: boolean;
    } => {
        if (!contact.hasAutoPayEnabled) {
            return {
                autoPayEnabled: false,
                withinThreshold: false
            };
        }

        const threshold = contact.getAutoPayThreshold;
        const withinThreshold = threshold === 0 || amount <= threshold;

        return {
            autoPayEnabled: true,
            withinThreshold
        };
    };

    public checkClipboardForInvoiceWithContacts = async (
        contacts: Contact[],
        forceCheck: boolean = false
    ): Promise<AutoPayInvoice | null> => {
        const basicInvoice = await this.checkClipboardForInvoice(forceCheck);
        if (!basicInvoice) return null;

        const contact = await this.findContactForInvoice(
            basicInvoice.invoice,
            contacts
        );

        if (contact) {
            const autoPayRules = this.validateAutoPayRules(
                contact,
                basicInvoice.amount
            );

            return {
                ...basicInvoice,
                contact,
                autoPayEnabled: autoPayRules.autoPayEnabled,
                withinThreshold: autoPayRules.withinThreshold
            };
        }

        return basicInvoice;
    };

    public checkClipboardForInvoice = async (
        forceCheck: boolean = false
    ): Promise<AutoPayInvoice | null> => {
        try {
            const clipboardContent = await Clipboard.getString();

            if (!clipboardContent) {
                return null;
            }

            // Check if we should process this clipboard content
            if (!this.shouldCheckClipboard(clipboardContent, forceCheck)) {
                return null;
            }

            const lowerContent = clipboardContent.toLowerCase().trim();
            if (
                lowerContent.startsWith('lnbc') ||
                lowerContent.startsWith('lnbcrt') ||
                lowerContent.startsWith('lntb')
            ) {
                try {
                    const decodedInvoice =
                        await BackendUtils.decodePaymentRequest([
                            clipboardContent
                        ]);

                    if (decodedInvoice) {
                        const payment_hash = decodedInvoice.payment_hash;

                        // Check if we're already processing this payment hash
                        if (
                            payment_hash &&
                            this.isCurrentlyProcessing(payment_hash)
                        ) {
                            return null;
                        }

                        Object.keys(decodedInvoice).forEach((key) => {
                            if (
                                ![
                                    'destination',
                                    'num_satoshis',
                                    'num_msat',
                                    'payment_hash',
                                    'description',
                                    'description_hash',
                                    'timestamp',
                                    'expiry',
                                    'cltv_expiry',
                                    'fallback_addr',
                                    'payment_addr',
                                    'route_hints',
                                    'features'
                                ].includes(key)
                            ) {
                            }
                        });
                        const amount =
                            decodedInvoice.num_satoshis ||
                            (decodedInvoice.num_msat
                                ? decodedInvoice.num_msat / 1000
                                : 0) ||
                            0;
                        const expiry = decodedInvoice.expiry || 0;

                        const currentTime = Math.floor(Date.now() / 1000);
                        const invoiceTime =
                            parseInt(decodedInvoice.timestamp) || 0;
                        const expiryTime = invoiceTime + expiry;

                        if (currentTime > expiryTime) {
                            return null;
                        }

                        return {
                            invoice: clipboardContent,
                            amount: Number(amount),
                            isValid: true,
                            payment_hash,
                            expiry
                        };
                    }
                } catch (error) {
                    console.error('Error decoding invoice:', error);
                    return null;
                }
            }

            return null;
        } catch (error) {
            console.error('Error checking clipboard for invoice:', error);
            return null;
        }
    };

    public validateInvoiceNotPaid = async (
        payment_hash: string
    ): Promise<boolean> => {
        try {
            const payments = await BackendUtils.getPayments({
                maxPayments: 100,
                reversed: true
            });

            if (payments && payments.payments) {
                const existingPayment = payments.payments.find(
                    (payment: any) => payment.payment_hash === payment_hash
                );

                if (existingPayment) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error(
                'AutoPay: Error validating invoice payment status:',
                error
            );
            return true;
        }
    };

    public showAutoPayDialog = (
        invoice: AutoPayInvoice,
        onPay: () => void,
        onIgnore: () => void
    ) => {
        const amountText =
            invoice.amount > 0
                ? `${invoice.amount} sats`
                : localeString('general.unknown') +
                  ' ' +
                  localeString('general.amount');

        let title = localeString('views.AutoPay.invoiceDetected');
        let message = `${localeString(
            'views.AutoPay.invoiceDetectedMessage'
        ).replace('{{amount}}', amountText)}`;

        if (invoice.contact) {
            title = `${localeString(
                'views.AutoPay.contactInvoiceDetected'
            )} - ${invoice.contact.name}`;
            message = `${localeString('views.AutoPay.contactInvoiceMessage')
                .replace('{{contact}}', invoice.contact.name)
                .replace('{{amount}}', amountText)}`;

            if (invoice.contact.hasAutoPayEnabled) {
                if (invoice.withinThreshold) {
                    message += `\n\n${localeString(
                        'views.AutoPay.autoPayEnabled'
                    )}`;
                } else {
                    message += `\n\n${localeString(
                        'views.AutoPay.exceedsThreshold'
                    ).replace(
                        '{{threshold}}',
                        `${invoice.contact.getAutoPayThreshold} sats`
                    )}`;
                }
            }
        }

        Alert.alert(
            title,
            message,
            [
                {
                    text: localeString('views.AutoPay.ignore'),
                    style: 'cancel',
                    onPress: onIgnore
                },
                {
                    text: localeString('views.AutoPay.pay'),
                    onPress: onPay
                }
            ],
            { cancelable: false }
        );
    };

    public markTransactionAsAutoPay = async (paymentHash: string) => {
        try {
            await autoPayStore.markTransactionAsAutoPay(paymentHash);
        } catch (error) {
            console.error('Error marking transaction as auto-pay:', error);
        }
    };

    public isAutoPayTransaction = (paymentHash: string): boolean => {
        return autoPayStore.isAutoPayTransaction(paymentHash);
    };

    public validateAutoPayRequirements = (
        isForContact: boolean = false,
        contact?: Contact
    ): { valid: boolean; message?: string } => {
        const clipboardEnabled = settingsStore.settings?.privacy?.clipboard;

        if (!clipboardEnabled) {
            return {
                valid: false,
                message: isForContact
                    ? localeString('views.AutoPay.contactRequirementsMessage')
                    : localeString('views.AutoPay.clipboardRequiredMessage')
            };
        }

        // For contact auto-pay, we need to check if pubkey exists when provided
        if (
            isForContact &&
            contact &&
            (!contact.pubkey ||
                contact.pubkey.length === 0 ||
                !contact.pubkey[0])
        ) {
            return {
                valid: false,
                message: localeString('views.AutoPay.pubkeyRequiredMessage')
            };
        }

        return { valid: true };
    };

    public validateContactPubkey = (
        pubkeyArray: string[]
    ): { valid: boolean; message?: string } => {
        if (!pubkeyArray || pubkeyArray.length === 0 || !pubkeyArray[0]) {
            return {
                valid: false,
                message: localeString('views.AutoPay.pubkeyRequiredMessage')
            };
        }
        return { valid: true };
    };

    public showAutoPayRequirementsDialog = (
        isForContact: boolean = false,
        contact?: Contact,
        onNavigateToPrivacy?: () => void
    ) => {
        const clipboardEnabled = settingsStore.settings?.privacy?.clipboard;

        if (!clipboardEnabled) {
            const title = localeString('views.AutoPay.requirementsTitle');
            const message = isForContact
                ? localeString('views.AutoPay.contactRequirementsMessage')
                : localeString('views.AutoPay.clipboardRequiredMessage');

            Alert.alert(
                title,
                message,
                [
                    {
                        text: localeString('general.cancel'),
                        style: 'cancel'
                    },
                    {
                        text: localeString('views.Settings.Privacy.title'),
                        onPress: onNavigateToPrivacy
                    }
                ],
                { cancelable: true }
            );
            return;
        }

        // For contact auto-pay, check if pubkey exists
        if (
            isForContact &&
            contact &&
            (!contact.pubkey ||
                contact.pubkey.length === 0 ||
                !contact.pubkey[0])
        ) {
            const title = localeString('views.AutoPay.requirementsTitle');
            const message = localeString('views.AutoPay.pubkeyRequiredMessage');

            Alert.alert(
                title,
                message,
                [
                    {
                        text: localeString('general.ok'),
                        style: 'default'
                    }
                ],
                { cancelable: true }
            );
            return;
        }
    };

    public showContactPubkeyRequiredDialog = () => {
        const title = localeString('views.AutoPay.requirementsTitle');
        const message = localeString('views.AutoPay.pubkeyRequiredMessage');

        Alert.alert(
            title,
            message,
            [
                {
                    text: localeString('general.ok'),
                    style: 'default'
                }
            ],
            { cancelable: true }
        );
    };
}

const autoPayUtils = new AutoPayUtils();
export default autoPayUtils;
