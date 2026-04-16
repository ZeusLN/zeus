import { Image } from 'react-native';
import RNFS from 'react-native-fs';

const zeusillustration1a = require('..//assets/images/zeus_illustration_1a.jpg');
const zeusillustration1b = require('..//assets/images/zeus_illustration_1b.jpg');
const zeusillustration2a = require('..//assets/images/zeus_illustration_2a.jpg');
const zeusillustration2b = require('..//assets/images/zeus_illustration_2b.jpg');
const zeusillustration3a = require('..//assets/images/zeus_illustration_3a.jpg');
const zeusillustration3b = require('..//assets/images/zeus_illustration_3b.jpg');
const zeusillustration4a = require('..//assets/images/zeus_illustration_4a.jpg');
const zeusillustration4b = require('..//assets/images/zeus_illustration_4b.jpg');
const zeusillustration5a = require('..//assets/images/zeus_illustration_5a.jpg');
const zeusillustration5b = require('..//assets/images/zeus_illustration_5b.jpg');
const zeusillustration6a = require('..//assets/images/zeus_illustration_6a.jpg');
const zeusillustration6b = require('..//assets/images/zeus_illustration_6b.jpg');
const zeusillustration7a = require('..//assets/images/zeus_illustration_7a.jpg');
const zeusillustration7b = require('..//assets/images/zeus_illustration_7b.jpg');

const Alby = require('..//assets/images/alby.jpg');
const AlbyHub = require('..//assets/images/albyhub.jpg');
const BTCpay = require('..//assets/images/btcpay.jpg');
const Cashu = require('..//assets/images/cashu.jpg');
const CLN = require('..//assets/images/cln.jpg');
const LND = require('..//assets/images/lnd.jpg');
const Nostr = require('..//assets/images/nostr.jpg');
const NostrWalletConnect = require('..//assets/images/nostrwalletconnect.jpg');
const LDK = require('..//assets/images/ldk.png');

const getPhoto = (photo: string | undefined): string => {
    if (typeof photo === 'string' && photo.includes('rnfs://')) {
        const fileName = photo.replace('rnfs://', '');
        return `file://${RNFS.DocumentDirectoryPath}/${fileName}`;
    }
    if (typeof photo === 'string' && photo.includes('preset://')) {
        const fileName = photo.replace('preset://', '');
        let file;
        if (fileName === 'zeusillustration1a') file = zeusillustration1a;
        if (fileName === 'zeusillustration2a') file = zeusillustration2a;
        if (fileName === 'zeusillustration3a') file = zeusillustration3a;
        if (fileName === 'zeusillustration4a') file = zeusillustration4a;
        if (fileName === 'zeusillustration5a') file = zeusillustration5a;
        if (fileName === 'zeusillustration6a') file = zeusillustration6a;
        if (fileName === 'zeusillustration7a') file = zeusillustration7a;

        if (fileName === 'zeusillustration1b') file = zeusillustration1b;
        if (fileName === 'zeusillustration2b') file = zeusillustration2b;
        if (fileName === 'zeusillustration3b') file = zeusillustration3b;
        if (fileName === 'zeusillustration4b') file = zeusillustration4b;
        if (fileName === 'zeusillustration5b') file = zeusillustration5b;
        if (fileName === 'zeusillustration6b') file = zeusillustration6b;
        if (fileName === 'zeusillustration7b') file = zeusillustration7b;

        if (fileName === 'alby') file = Alby;
        if (fileName === 'albyhub') file = AlbyHub;
        if (fileName === 'cashu') file = Cashu;
        if (fileName === 'btcpay') file = BTCpay;
        if (fileName === 'cln') file = CLN;
        if (fileName === 'lnd') file = LND;
        if (fileName === 'nostr') file = Nostr;
        if (fileName === 'nostrwalletconnect') file = NostrWalletConnect;
        if (fileName === 'ldk') file = LDK;

        return Image.resolveAssetSource(file)?.uri || '';
    }
    return photo || '';
};

const getPresetName = (assetUri: string): string => {
    const pathPart = assetUri.split('?')[0];
    const fileName = pathPart.split('/').pop() || '';
    return fileName
        .replace('.png', '')
        .replace('.jpg', '')
        .replace(/[-_]/g, '')
        .toLowerCase();
};

export { getPhoto, getPresetName };
