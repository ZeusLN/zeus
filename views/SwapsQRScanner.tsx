import { observer } from 'mobx-react';

import BaseQRScanner from './QRScanner/BaseQRScanner';

import { nodeInfoStore } from '../stores/Stores';

import Invoice from '../models/Invoice';

import { localeString } from '../utils/LocaleUtils';
import AddressUtils from '../utils/AddressUtils';
import BackendUtils from '../utils/BackendUtils';

@observer
export default class SwapsQRScanner extends BaseQRScanner {
    protected async processQRData(data: string): Promise<void> {
        const { navigation } = this.props;
        const { value, satAmount } = AddressUtils.processBIP21Uri(data);

        const { nodeInfo } = nodeInfoStore;
        const { isTestNet, isRegTest, isSigNet } = nodeInfo;

        // Reverse Swap - Bitcoin address
        if (
            AddressUtils.isValidBitcoinAddress(
                value,
                isTestNet || isRegTest || isSigNet
            )
        ) {
            navigation.goBack();
            navigation.navigate('Swaps', {
                initialInvoice: value,
                initialAmountSats: satAmount,
                initialReverse: true
            });
            return;
        }

        // Submarine Swap - Lightning invoice
        if (AddressUtils.isValidLightningPaymentRequest(value)) {
            const decodedInvoice = await BackendUtils.decodePaymentRequest([
                value
            ]);

            if (!decodedInvoice) {
                throw new Error(localeString('views.Invoice.couldNotDecode'));
            }

            const invoiceModel = new Invoice(decodedInvoice);
            const amount = invoiceModel.getRequestAmount;

            navigation.goBack();
            navigation.navigate('Swaps', {
                initialInvoice: value,
                initialAmountSats: amount,
                initialReverse: false
            });
            return;
        }

        throw new Error(localeString('components.QRCodeScanner.notRecognized'));
    }
}
