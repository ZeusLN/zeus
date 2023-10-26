import BigNumber from 'bignumber.js';
import { SATS_PER_BTC } from '../stores/UnitsStore';

const btcNonBech = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const btcBech = /^(bc1|BC1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/;

const lnInvoice =
    /^(lnbcrt|lntb|lnbc|LNBCRT|LNTB|LNBC)([0-9]{1,}[a-zA-Z0-9]+){1}$/;
const lnPubKey = /^[a-f0-9]{66}$/;

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

export const CUSTODIAL_LNDHUBS = [
    'https://lndhub.io',
    'https://lndhub.herokuapp.com',
    'https://legend.lnbits.com/wallet',
    'https://infinity.lnbits.com/wallet',
    'https://ln.getalby.com'
];

const bitcoinQrParser = (input: string, prefix: string) => {
    let amount, lightning;
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

    return [value, amount, lightning];
};

class AddressUtils {
    processSendAddress = (input: string) => {
        let value, amount, lightning;

        // handle addresses prefixed with 'bitcoin:' and
        // payment requests prefixed with 'lightning:'

        // handle BTCPay invoices with amounts embedded
        if (input.includes('bitcoin:') || input.includes('BITCOIN:')) {
            const [parsedValue, parsedAmount, parsedLightning] =
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
        } else if (input.includes('lightning:')) {
            value = input.split('lightning:')[1];
        } else if (input.includes('LIGHTNING:')) {
            value = input.split('LIGHTNING:')[1];
        } else if (input.includes('zeusln:')) {
            value = input.split('zeusln:')[1];
        } else {
            value = input;
        }

        return { value, amount, lightning };
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

    isValidLightningPaymentRequest = (input: string) => lnInvoice.test(input);

    isValidLightningPubKey = (input: string) => lnPubKey.test(input);

    isValidLNDHubAddress = (input: string) =>
        lndHubAddress.test(input) || blueWalletAddress.test(input);

    isValidLightningAddress = (input: string) => lightningAddress.test(input);

    isValidNpub = (input: string) => npubFormat.test(input);
}

const addressUtils = new AddressUtils();
export default addressUtils;
