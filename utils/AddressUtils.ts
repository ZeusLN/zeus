import BigNumber from 'bignumber.js';
const bitcoin = require('bitcoinjs-lib');

import Base64Utils from '../utils/Base64Utils';

import { SATS_PER_BTC } from '../utils/UnitsUtils';

import { walletrpc } from '../proto/lightning';

const btcNonBech = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const btcBech = /^(bc1|BC1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/;

/*
 BOLT 11
 https://github.com/lightning/bolts/blob/master/11-payment-encoding.md#human-readable-part
 lnbc - mainnet
 lntb - testnet
 lntbs - signet
 lnbcrt - regtest
*/
const lnInvoice =
    /^(lnbc|lntb|lntbs|lnbcrt|LNBC|LNTB|LNTBS|LNBCRT)([0-9]{1,}[a-zA-Z0-9]+){1}$/;
const lnPubKey = /^[a-f0-9]{66}$/;

/* BIP-21 */
const bip21Uri =
    /^(bitcoin|BITCOIN):([13a-zA-Z0-9]{25,42})?(\?((amount|AMOUNT)=([0-9]+(\.[0-9]+)?)|(label|LABEL|message|MESSAGE|lightning|LIGHTNING|lno|LNO)=([^&]*))((&((amount|AMOUNT)=([0-9]+(\.[0-9]+)?)|(label|LABEL|message|MESSAGE|lightning|LIGHTNING|lno|LNO)=([^&]*)))*))?/;

/* BOLT 12 */
const lnOffer = /^(lno|LNO)([0-9]{1,}[a-zA-Z0-9]+){1}$/;

/* testnet */
const btcNonBechTestnet = /^[2][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const btcBechTestnet = /^(bc1|bcrt1|BC1|BCRT1|[2])[a-zA-HJ-NP-Z0-9]{25,89}$/;
const btcBechPubkeyScriptHashTestnet =
    /^(tb1|TB1|[2])[a-zA-HJ-NP-Z0-9]{25,89}$/;

/* lndhub */
const lndHubAddress =
    /^(lndhub:\/\/)[\w-]+(:)\w+(@https?:\/\/[\w\-_.]+(:\d{1,5})?([\w/-]+)?)?$/;

/* lnurl */
const lightningAddress =
    /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;

const blueWalletAddress = /^bluewallet:setlndhuburl\?url=(\S+)/;

/* npub */
const npubFormat = /^npub1[0-9a-z]{58}$/;

/* xpub,ypub,zpub,vpub */
const xpubFormat = /^(xpub|ypub|zpub|vpub|tpub)(.*)/;

/* psbt */
const psbt = /^((cHN)|(psbt))[,:]?.*$/;

/* string wallet export */
const stringWalletExport =
    /^\[[0-9a-fA-F]+\/\d+[',h]\/\d+[',h]\/\d+[',h]\](xpub|ypub|zpub|vpub|tpub)[a-zA-Z0-9]+/;

/* descriptors */
const wpkhDescriptor =
    /^wpkh\(\[[a-zA-Z0-9]+\/[0-9]+h\/[0-9]+h\/[0-9]+h\](xpub|ypub|zpub|vpub|tpub)[a-zA-Z0-9]+\/<([0-9]+);([0-9]+)>\/[*]\)#([a-zA-Z0-9]+)$/;

const nestedWpkhDescriptor =
    /^sh\(wpkh\(\[[a-zA-Z0-9]+\/[0-9]+h\/[0-9]+h\/[0-9]+h\](xpub|ypub|zpub|vpub|tpub)[a-zA-Z0-9]+\/<([0-9]+);([0-9]+)>\/[*]\)\)#([a-zA-Z0-9]+)$/;

const snakeCase = /^[a-zA-Z]+(?:_[a-zA-Z]+)*$/;

export const CUSTODIAL_LNDHUBS = [
    'https://lndhub.io',
    'https://lndhub.herokuapp.com',
    'https://legend.lnbits.com/wallet',
    'https://infinity.lnbits.com/wallet',
    'https://ln.getalby.com'
];

const bitcoinQrParser = (input: string, prefix: string) => {
    let amount, lightning, offer;
    const btcAddressAndParams = input.split(prefix)[1];
    const [btcAddress, params] = btcAddressAndParams.split('?');

    const result: any = {};
    params &&
        params.split('&').forEach(function (part) {
            const item = part.split('=');
            result[item[0]] = decodeURIComponent(item[1]);
        });

    const value = btcAddress;
    if (result.amount || result.AMOUNT) {
        amount = new BigNumber(result.amount || result.AMOUNT).multipliedBy(
            SATS_PER_BTC
        );
        amount = amount.toString();
    }

    if (result.lightning || result.LIGHTNING) {
        lightning = result.lightning || result.LIGHTNING;
    }

    if (result.lno || result.LNO) {
        offer = result.lno || result.LNO;
    }

    return [value, amount, lightning, offer];
};

class AddressUtils {
    processBIP21Uri = (input: string) => {
        let value, amount, lightning, offer;

        // handle addresses prefixed with 'bitcoin:' and
        // payment requests prefixed with 'lightning:'

        // handle BTCPay invoices with amounts embedded
        if (input.includes('bitcoin:') || input.includes('BITCOIN:')) {
            const [parsedValue, parsedAmount, parsedLightning, parsedOffer] =
                bitcoinQrParser(
                    input,
                    input.includes('BITCOIN:') ? 'BITCOIN:' : 'bitcoin:'
                );
            value = parsedValue;

            if (parsedAmount) {
                amount = parsedAmount;
            }

            if (parsedLightning) {
                lightning = parsedLightning;
            }

            if (parsedOffer) {
                offer = parsedOffer;
            }
        } else if (input.includes('lightning:')) {
            value = input.split('lightning:')[1];
        } else if (input.includes('LIGHTNING:')) {
            value = input.split('LIGHTNING:')[1];
        } else if (input.includes('zeusln:')) {
            value = input.split('zeusln:')[1];
        } else {
            value = input;
        }

        return { value, amount, lightning, offer };
    };

    processLNDHubAddress = (input: string) => {
        if (!this.isValidLNDHubAddress(input)) {
            throw new Error('Could not process invalid LNDHub account address');
        }

        if (input.includes('lndhub://')) {
            input = input.replace('lndhub://', '');
            let value;
            let host;

            if (input.indexOf('@') !== -1) {
                const [namepass, serverURL] = input.split('@');
                value = namepass;
                host = serverURL;
            } else {
                value = input;
                host = CUSTODIAL_LNDHUBS[0];
            }

            const [username, password] = value.split(':');
            return { username, password, host };
        } else {
            input = input.replace('bluewallet:setlndhuburl?url=', '');
            input = decodeURIComponent(input);
            return { host: input };
        }
    };

    isValidBitcoinAddress = (input: string, testnet: boolean) => {
        if (testnet) {
            return (
                btcNonBechTestnet.test(input) ||
                btcBechTestnet.test(input) ||
                btcBechPubkeyScriptHashTestnet.test(input)
            );
        }

        return btcNonBech.test(input) || btcBech.test(input);
    };

    isValidBIP21Uri = (input: string) => bip21Uri.test(input);

    isValidLightningPaymentRequest = (input: string) => lnInvoice.test(input);
    isValidLightningOffer = (input: string) => lnOffer.test(input);

    isValidLightningPubKey = (input: string) => lnPubKey.test(input);

    isValidLNDHubAddress = (input: string) =>
        lndHubAddress.test(input) || blueWalletAddress.test(input);

    isValidLightningAddress = (input: string) => lightningAddress.test(input);

    isValidNpub = (input: string) => npubFormat.test(input);

    isValidXpub = (input: string) => xpubFormat.test(input);

    isPsbt = (input: string) => psbt.test(input);

    isValidTxHex = (txHex: string) => {
        try {
            bitcoin.Transaction.fromHex(txHex);
            return true; // Parsing succeeded, so it's a valid transaction hex
        } catch (error) {
            return false; // Parsing failed, so it's not a valid transaction hex
        }
    };

    isKeystoreWalletExport = (walletExport: string) => {
        try {
            const parsed = JSON.parse(walletExport);
            if (parsed.keystore?.xpub && parsed.keystore?.ckcc_xfp) return true;
            return false;
        } catch (error) {
            return false;
        }
    };

    processKeystoreWalletExport = (input: string) => {
        try {
            const parsed = JSON.parse(input);
            const { keystore } = parsed;
            const { xpub, label, ckcc_xfp } = keystore;

            return {
                MasterFingerprint: Base64Utils.mfpIntToBytes(ckcc_xfp),
                ExtPubKey: xpub,
                Label: label
            };
        } catch (e: any) {
            // console.error('Error processing wallet export');
            return {
                MasterFingerprint: '',
                ExtPubKey: '',
                Label: ''
            };
        }
    };

    isJsonWalletExport = (walletExport: string) => {
        try {
            const parsed = JSON.parse(walletExport);
            if (parsed.MasterFingerprint && parsed.ExtPubKey) return true;
            return false;
        } catch (error) {
            return false;
        }
    };

    isStringWalletExport = (input: string) => stringWalletExport.test(input);

    processStringWalletExport = (input: string) => {
        try {
            const MasterFingerprint = input.split('[')[1].split('/')[0];
            const ExtPubKey = input.split(']')[1];

            return {
                MasterFingerprint,
                ExtPubKey
            };
        } catch (e: any) {
            // console.error('Error processing wallet export');
            return {
                MasterFingerprint: '',
                ExtPubKey: ''
            };
        }
    };

    isWpkhDescriptor = (input: string) => wpkhDescriptor.test(input);
    isNestedWpkhDescriptor = (input: string) =>
        nestedWpkhDescriptor.test(input);

    processWpkhDescriptor = (input: string) => {
        try {
            const MasterFingerprint = input.split('wpkh([')[1].split('/')[0];
            const ExtPubKey = input.split(']')[1].split('/')[0];
            const AddressType = walletrpc.AddressType.WITNESS_PUBKEY_HASH;

            return {
                MasterFingerprint,
                ExtPubKey,
                AddressType
            };
        } catch (e: any) {
            return {
                MasterFingerprint: '',
                ExtPubKey: ''
            };
        }
    };

    processNestedWpkhDescriptor = (input: string) => {
        try {
            const MasterFingerprint = input.split('sh(wpkh([')[1].split('/')[0];
            const ExtPubKey = input.split(']')[1].split('/')[0];
            const AddressType =
                walletrpc.AddressType.NESTED_WITNESS_PUBKEY_HASH;

            return {
                MasterFingerprint,
                ExtPubKey,
                AddressType
            };
        } catch (e: any) {
            return {
                MasterFingerprint: '',
                ExtPubKey: ''
            };
        }
    };

    snakeToHumanReadable = (input: string) => {
        let output = input;
        if (snakeCase.test(input)) {
            // remove capital demarcation with spaces, move all to lowercase
            output = output.split('_').join(' ').toLowerCase();
            // capitalize first letter
            output = output.charAt(0).toUpperCase() + output.slice(1);
        }
        return output;
    };
}

const addressUtils = new AddressUtils();
export default addressUtils;
