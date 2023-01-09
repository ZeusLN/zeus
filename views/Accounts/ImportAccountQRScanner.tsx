import * as React from 'react';
import { Alert } from 'react-native';

import QRCodeScanner from './../../components/QRCodeScanner';
import { localeString } from './../../utils/LocaleUtils';
import {
    decodeUR,
    extractSingleWorkload,
    BlueURDecoder
} from './../../zeus_modules/ur';
const createHash = require('create-hash');
const base = require('base-x');
const bitcoin = require('bitcoinjs-lib');

interface ImportAccountQRScannerProps {
    navigation: any;
    route: any;
}

const Base43 = {
    encode() {
        throw new Error('not implemented');
    },

    decode(input) {
        const x = base('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:');
        return x.decode(input).toString('hex');
    }
};

const ImportAccountQRScanner = (props: ImportAccountQRScannerProps) => {
    let decoder, launchedBy;
    const scannedCache = {};
    // const [urTotal, setUrTotal] = React.useState(0);
    // const [urHave, setUrHave] = React.useState(0);
    const [animatedQRCodeData, setAnimatedQRCodeData] = React.useState({});
    const [isLoading, setIsLoading] = React.useState(false);
    const navigation = props.navigation;

    const HashIt = function (s) {
        return createHash('sha256').update(s).digest().toString('hex');
    };

    const _onReadUniformResourceV2 = (part) => {
        if (!decoder) decoder = new BlueURDecoder();
        try {
            decoder.receivePart(part);
            if (decoder.isComplete()) {
                const data = decoder.toString();
                decoder = false; // nullify for future use (?)
                if (launchedBy) {
                    navigation.navigate(launchedBy);
                }
                navigation.navigate('ImportAccount', { qrResponse: data });
            } else {
                // setUrTotal(100);
                // setUrHave(Math.floor(decoder.estimatedPercentComplete() * 100));
            }
        } catch (error) {
            console.warn(error);
            setIsLoading(true);
            Alert.alert(
                localeString('general.error'),
                localeString('views.LNDConnectConfigQRScanner.error'),
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    };

    /**
     *
     * @deprecated remove when we get rid of URv1 support
     */
    const _onReadUniformResource = (ur) => {
        try {
            const [index, total] = extractSingleWorkload(ur);
            animatedQRCodeData[index + 'of' + total] = ur;
            // setUrTotal(total);
            // setUrHave(Object.values(animatedQRCodeData).length);
            if (Object.values(animatedQRCodeData).length === total) {
                const payload = decodeUR(Object.values(animatedQRCodeData));
                // lets look inside that data
                let data = false;
                if (Buffer.from(payload, 'hex').toString().startsWith('psbt')) {
                    // its a psbt, and whoever requested it expects it encoded in base64
                    data = Buffer.from(payload, 'hex').toString('base64');
                } else {
                    // its something else. probably plain text is expected
                    data = Buffer.from(payload, 'hex').toString();
                }
                navigation.navigate('ImportAccount', { qrResponse: data });
            } else {
                setAnimatedQRCodeData(animatedQRCodeData);
            }
        } catch (error) {
            console.warn(error);
            setIsLoading(true);
            Alert.alert(
                localeString('general.error'),
                localeString('views.LNDConnectConfigQRScanner.error'),
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        }
    };

    const onBarCodeRead = (ret) => {
        const h = HashIt(ret);
        if (scannedCache[h]) {
            // this QR was already scanned by this ScanQRCode, lets prevent firing duplicate callbacks
            return;
        }
        scannedCache[h] = +new Date();

        if (ret.toUpperCase().startsWith('UR:CRYPTO-PSBT')) {
            return _onReadUniformResourceV2(ret);
        }

        if (ret.toUpperCase().startsWith('UR:BYTES')) {
            const splitted = ret.split('/');
            if (splitted.length === 3 && splitted[1].includes('-')) {
                return _onReadUniformResourceV2(ret);
            }
        }

        if (ret.toUpperCase().startsWith('UR')) {
            return _onReadUniformResource(ret);
        }

        // is it base43? stupid electrum desktop
        try {
            const hex = Base43.decode(ret);
            bitcoin.Psbt.fromHex(hex); // if it doesnt throw - all good

            if (launchedBy) {
                navigation.navigate(launchedBy);
            }
            navigation.navigate('ImportAccount', {
                qrResponse: Buffer.from(hex, 'hex').toString('base64')
            });
            return;
        } catch (err) {
            console.warn(err);
        }

        if (!isLoading) {
            setIsLoading(true);
            try {
                if (launchedBy) {
                    navigation.navigate(launchedBy);
                }
                navigation.navigate('ImportAccount', { qrResponse: ret });
            } catch (e) {
                console.log(e);
            }
        }
        setIsLoading(false);
    };

    return (
        <QRCodeScanner
            title={'QR title'}
            text={'QR text'}
            handleQRScanned={onBarCodeRead}
            goBack={() => navigation.goBack()}
        />
    );
};

export default ImportAccountQRScanner;
