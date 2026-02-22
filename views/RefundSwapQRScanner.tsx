import { observer } from 'mobx-react';

import BaseQRScanner from './QRScanner/BaseQRScanner';

import { nodeInfoStore } from '../stores/Stores';

import { localeString } from '../utils/LocaleUtils';
import AddressUtils from '../utils/AddressUtils';

@observer
export default class RefundSwapQRScanner extends BaseQRScanner {
    protected async processQRData(data: string): Promise<void> {
        const { navigation } = this.props;
        const { value } = AddressUtils.processBIP21Uri(data);

        const { nodeInfo } = nodeInfoStore;
        const { isTestNet, isRegTest, isSigNet } = nodeInfo;

        if (
            AddressUtils.isValidBitcoinAddress(
                value,
                isTestNet || isRegTest || isSigNet
            )
        ) {
            navigation.goBack();
            navigation.navigate('RefundSwap', {
                scannedAddress: value
            });
            return;
        }

        throw new Error(localeString('components.QRCodeScanner.notRecognized'));
    }
}
