import { Image } from 'react-native';
import RNFS from 'react-native-fs';

const zeusillustration1a = require('..//assets/images/zeus-illustration-1a.jpg');
const zeusillustration1b = require('..//assets/images/zeus-illustration-1b.jpg');
const zeusillustration2a = require('..//assets/images/zeus-illustration-2a.jpg');
const zeusillustration2b = require('..//assets/images/zeus-illustration-2b.jpg');
const zeusillustration3a = require('..//assets/images/zeus-illustration-3a.jpg');
const zeusillustration3b = require('..//assets/images/zeus-illustration-3b.jpg');
const zeusillustration4a = require('..//assets/images/zeus-illustration-4a.jpg');
const zeusillustration4b = require('..//assets/images/zeus-illustration-4b.jpg');
const zeusillustration5a = require('..//assets/images/zeus-illustration-5a.jpg');
const zeusillustration5b = require('..//assets/images/zeus-illustration-5b.jpg');
const zeusillustration6a = require('..//assets/images/zeus-illustration-6a.jpg');
const zeusillustration6b = require('..//assets/images/zeus-illustration-6b.jpg');
const zeusillustration7a = require('..//assets/images/zeus-illustration-7a.jpg');
const zeusillustration7b = require('..//assets/images/zeus-illustration-7b.jpg');

const Alby = require('..//assets/images/Alby.jpg');
const BTCpay = require('..//assets/images/BTCpay.jpg');
const CLN = require('..//assets/images/CLN.jpg');
const LND = require('..//assets/images/LND.jpg');

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
        if (fileName === 'btcpay') file = BTCpay;
        if (fileName === 'cln') file = CLN;
        if (fileName === 'lnd') file = LND;

        return Image.resolveAssetSource(file)?.uri || '';
    }
    return photo || '';
};

export { getPhoto };
