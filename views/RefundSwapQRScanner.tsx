import { observer } from 'mobx-react';

import BaseQRScanner from './QRScanner/BaseQRScanner';

import { localeString } from '../utils/LocaleUtils';
import AddressUtils from '../utils/AddressUtils';

@observer
export default class RefundSwapQRScanner extends BaseQRScanner {
    protected async processQRData(data: string): Promise<void> {
        const { navigation } = this.props;
        const { value } = AddressUtils.processBIP21Uri(data);

        if (AddressUtils.isValidBitcoinAddressForNode(value)) {
            navigation.goBack();
            navigation.navigate({
                name: 'RefundSwap',
                params: { scannedAddress: value },
                merge: true
            });
            return;
        }

        throw new Error(localeString('components.QRCodeScanner.notRecognized'));
    }
}
