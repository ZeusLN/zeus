import { Platform } from 'react-native';
import { action, observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Notifications } from 'react-native-notifications';

import BigNumber from 'bignumber.js';
import bolt11 from 'bolt11';
import { io } from 'socket.io-client';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex } from '@noble/hashes/utils';
import hashjs from 'hash.js';
// @ts-ignore:next-line
import { getPublicKey, relayInit } from 'nostr-tools';

const bip39 = require('bip39');

import { sha256 } from 'js-sha256';

import CashuStore from './CashuStore';
import NodeInfoStore from './NodeInfoStore';
import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { sleep } from '../utils/SleepUtils';
import { localeString } from '../utils/LocaleUtils';

import Storage from '../storage';

const LNURL_HOST = 'https://zeuspay.com/api';
const LNURL_SOCKET_HOST = 'https://zeuspay.com';
const LNURL_SOCKET_PATH = '/stream';

export const LEGACY_ADDRESS_ACTIVATED_STRING = 'olympus-lightning-address';
export const LEGACY_HASHES_STORAGE_STRING = 'olympus-lightning-address-hashes';

export const ADDRESS_ACTIVATED_STRING = 'zeuspay-lightning-address';
export const HASHES_STORAGE_STRING = 'zeuspay-lightning-address-hashes';

export const ZEUS_PAY_DOMAIN_KEYS = [
    {
        key: 'zeuspay.com',
        value: 'zeuspay.com'
    },
    {
        key: 'zeusnuts.com',
        value: 'zeusnuts.com'
    }
];

interface Auth {
    verification: string;
    signature: string;
}

export default class LightningAddressStore {
    @observable public lightningAddress: string;
    @observable public lightningAddressHandle: string;
    @observable public lightningAddressDomain: string;
    @observable public lightningAddressType: string;
    @observable public lightningAddressActivated: boolean = false;
    @observable public zeusPlusExpiresAt: any;
    @observable public loading: boolean = false;
    @observable public redeeming: boolean = false;
    @observable public redeemingAll: boolean = false;
    @observable public error: boolean = false;
    @observable public error_msg: string | undefined;
    @observable public availableHashes: number = 0; // on server
    @observable public localHashes: number = 0; // on device
    @observable public paid: any = [];
    @observable public preimageMap: any = {};
    @observable public fees: any = {};
    @observable public minimumSats: number;
    @observable public socket: any;
    // Push
    @observable public currentDeviceToken: string;
    @observable public serviceDeviceToken: string;
    @observable public readyToAutomaticallyAccept: boolean = false;
    @observable public prepareToAutomaticallyAcceptStart: boolean = false;
    // Auth
    auth: Auth;
    authDate?: Date;

    cashuStore: CashuStore;
    nodeInfoStore: NodeInfoStore;
    settingsStore: SettingsStore;

    constructor(
        cashuStore: CashuStore,
        nodeInfoStore: NodeInfoStore,
        settingsStore: SettingsStore
    ) {
        this.cashuStore = cashuStore;
        this.nodeInfoStore = nodeInfoStore;
        this.settingsStore = settingsStore;
    }

    private getAuthData = async () => {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        if (this.authDate && this.authDate > tenMinutesAgo) {
            return this.auth;
        } else {
            const authResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/auth`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                })
            );

            const authData = authResponse.json();
            if (authResponse.info().status !== 200) throw authData.error;

            const { verification } = authData;
            const signData = await BackendUtils.signMessage(verification);
            const signature = signData.zbase || signData.signature;

            this.auth = { verification, signature };
            this.authDate = new Date(Date.now());

            return this.auth;
        }
    };

    public deleteAndGenerateNewPreimages = async () => {
        this.loading = true;
        await Storage.setItem(HASHES_STORAGE_STRING, '');
        this.generatePreimages(true);
    };

    @action
    public deleteLocalHashes = async () => {
        this.loading = true;
        await Storage.setItem(HASHES_STORAGE_STRING, '');
        this.preimageMap = {};
        this.localHashes = 0;
        await this.status();
        this.loading = false;
    };

    private getPreimageMap = async () => {
        this.loading = true;
        const map = await Storage.getItem(HASHES_STORAGE_STRING);

        runInAction(() => {
            if (map) {
                this.preimageMap = JSON.parse(map);
                this.localHashes = Object.keys(this.preimageMap).length;
            }

            this.loading = false;
        });
        return this.preimageMap;
    };

    private setLightningAddress = async (handle: string, domain: string) => {
        await Storage.setItem(ADDRESS_ACTIVATED_STRING, true);
        runInAction(() => {
            this.lightningAddressActivated = true;
            this.lightningAddressHandle = handle;
            this.lightningAddressDomain = domain;
            this.lightningAddress = `${handle}@${domain}`;
        });
    };

    private deleteHash = async (hash: string) => {
        const hashesString =
            (await Storage.getItem(HASHES_STORAGE_STRING)) || '{}';

        const oldHashes = JSON.parse(hashesString);
        delete oldHashes[hash];
        const newHashes = oldHashes;

        return await Storage.setItem(HASHES_STORAGE_STRING, newHashes);
    };

    @action
    private generatePreimages = async (newDevice?: boolean) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        const preimageHashMap: any = {};

        const preimages = [];
        for (let i = 0; i < 250; i++) {
            preimages.push(
                bip39.mnemonicToEntropy(bip39.generateMnemonic(256))
            );
        }

        const hashes: any = [];
        const nostrSignatures: any = [];
        if (preimages) {
            const nostrPrivateKey =
                this.settingsStore?.settings?.lightningAddress?.nostrPrivateKey;
            for (let i = 0; i < preimages.length; i++) {
                const preimage = preimages[i];
                const hash = sha256
                    .create()
                    .update(Base64Utils.hexToBytes(preimage))
                    .hex();
                if (nostrPrivateKey) {
                    const pmthash_sig = bytesToHex(
                        schnorr.sign(hash, nostrPrivateKey)
                    );
                    nostrSignatures.push(pmthash_sig);
                }
                preimageHashMap[hash] = preimage;
                hashes.push(hash);
            }
        }

        const hashesString = await Storage.getItem(HASHES_STORAGE_STRING);

        let newHashes;
        if (hashesString) {
            const oldHashes = JSON.parse(hashesString);
            newHashes = {
                ...oldHashes,
                ...preimageHashMap
            };
        } else {
            newHashes = {
                ...preimageHashMap
            };
        }

        await Storage.setItem(HASHES_STORAGE_STRING, newHashes);

        try {
            const { verification, signature } = await this.getAuthData();

            const payload = {
                pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                message: verification,
                signature,
                hashes,
                newDevice,
                ...(nostrSignatures.length > 0 && { nostrSignatures })
            };

            const submitResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/submitHashes`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify(payload)
            );

            const submitData = submitResponse.json();
            if (!submitData.success) throw submitData.error;

            this.loading = false;
            await this.status();
            return { created_at: submitData.created_at };
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.loading = false;
                this.error = true;
                this.error_msg = error_msg;
            });
            throw error;
        }
    };

    @action
    public createZaplocker = async (
        nostr_pk: string,
        nostrPrivateKey: string,
        relays: Array<string>
    ) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
            const { verification, signature } = await this.getAuthData();

            const relays_sig = bytesToHex(
                schnorr.sign(
                    hashjs
                        .sha256()
                        .update(JSON.stringify(relays))
                        .digest('hex'),
                    nostrPrivateKey
                )
            );

            const createResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/create`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature,
                    nostr_pk,
                    relays,
                    relays_sig,
                    address_type: 'zaplocker'
                })
            );

            const createData = createResponse.json();
            if (createResponse.info().status !== 200 || !createData.success) {
                throw createData.error;
            }

            const { handle: responseHandle, domain, success } = createData;

            if (responseHandle) {
                this.setLightningAddress(responseHandle, domain);
            }

            await this.settingsStore.updateSettings({
                lightningAddress: {
                    enabled: true,
                    automaticallyAccept: true,
                    automaticallyRequestOlympusChannels: false, // deprecated
                    allowComments: true,
                    nostrPrivateKey,
                    nostrRelays: relays,
                    notifications: 1
                }
            });

            runInAction(() => {
                // ensure push credentials are in place
                // right after creation
                this.updatePushCredentials();
                this.loading = false;
            });

            return { success };
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.loading = false;
                this.error = true;
                this.error_msg = error_msg;
            });
            throw error;
        }
    };

    @action
    public createCashu = async (mint_url: string) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
            const { verification, signature } = await this.getAuthData();

            if (!this.cashuStore.cashuWallets[mint_url].wallet)
                await this.cashuStore.initializeWallet(mint_url, true);

            const createResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/create`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    cashu_pubkey: this.cashuStore.cashuWallets[mint_url].pubkey,
                    message: verification,
                    signature,
                    mint_url,
                    address_type: 'cashu'
                })
            );

            const createData = createResponse.json();
            if (createResponse.info().status !== 200 || !createData.success) {
                throw createData.error;
            }

            const { handle: responseHandle, domain, success } = createData;

            if (responseHandle) {
                this.setLightningAddress(responseHandle, domain);
            }

            await this.settingsStore.updateSettings({
                lightningAddress: {
                    enabled: true,
                    automaticallyAccept: true,
                    allowComments: true,
                    mintUrl: mint_url
                }
            });

            runInAction(() => {
                // ensure push credentials are in place
                // right after creation
                this.updatePushCredentials();
                this.loading = false;
            });

            return { success };
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.error_msg = error_msg;
                this.error = true;
                this.loading = false;
            });
            throw error;
        }
    };

    @action
    public createNWC = async (nwc_string: string) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
            const { verification, signature } = await this.getAuthData();

            const createResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/create`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature,
                    nwc_string,
                    address_type: 'nwc'
                })
            );

            const createData = createResponse.json();
            if (createResponse.info().status !== 200 || !createData.success) {
                throw createData.error;
            }

            const { handle: responseHandle, domain, success } = createData;

            if (responseHandle) {
                this.setLightningAddress(responseHandle, domain);
            }

            await this.settingsStore.updateSettings({
                lightningAddress: {
                    enabled: true,
                    automaticallyAccept: true,
                    allowComments: true
                }
            });

            runInAction(() => {
                // ensure push credentials are in place
                // right after creation
                this.updatePushCredentials();
                this.loading = false;
            });

            return { success };
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.error_msg = error_msg;
                this.error = true;
                this.loading = false;
            });
            throw error;
        }
    };

    @action
    public testNWCConnectionString = async (nwc_string: string) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
            const createResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/nwc/test`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    nwc_string
                })
            );

            const createData = createResponse.json();
            if (createResponse.info().status !== 200 || !createData.success) {
                throw createData.error;
            }

            const { success, error } = createData;

            runInAction(() => {
                if (error) {
                    this.error = true;
                    this.error_msg = error;
                }
                this.loading = false;
            });

            return { success };
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.error_msg = error_msg;
                this.error = true;
                this.loading = false;
            });
            throw error;
        }
    };

    @action
    public update = async (updates: any) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
            const { verification, signature } = await this.getAuthData();

            const updateResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/update`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature,
                    updates,
                    address_type: this.lightningAddressType
                })
            );

            const updateData = updateResponse.json();
            if (updateResponse.info().status !== 200 || !updateData.success) {
                throw updateData.error;
            }

            const { handle, domain, success } = updateData;

            if (handle) {
                this.setLightningAddress(handle, domain || 'zeuspay.com');
            }

            this.loading = false;
            return { success };
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.loading = false;
                this.error = true;
                this.error_msg = error_msg;
            });
            throw error;
        }
    };

    private enhanceWithFee = (paymentArray: Array<any>) =>
        paymentArray.map((item: any) => {
            let fee;
            try {
                const decoded = bolt11.decode(item.hodl);
                if (decoded.millisatoshis) {
                    fee = new BigNumber(decoded.millisatoshis)
                        .minus(item.amount_msat)
                        .div(1000);
                }
            } catch (e) {}
            item.fee = fee;
            return item;
        });

    @action
    public status = async (isRedeem?: boolean) => {
        this.loading = true;

        try {
            const { verification, signature } = await this.getAuthData();

            const statusResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/status`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature
                })
            );

            const statusData = statusResponse.json();
            if (statusResponse.info().status !== 200 || !statusData.success) {
                throw statusData.error;
            }

            const {
                results,
                paid,
                fees,
                minimumSats,
                handle,
                domain,
                addressType,
                plusExpiresAt,
                deviceToken
            } = statusData;

            runInAction(() => {
                if (!isRedeem) {
                    this.error = false;
                    this.error_msg = '';
                }
                this.loading = false;
                this.availableHashes = results || 0;
            });

            await this.getPreimageMap();

            runInAction(() => {
                this.paid = this.enhanceWithFee(paid);
                this.fees = fees;
                this.minimumSats = minimumSats;
                this.lightningAddressHandle = handle;
                this.lightningAddressDomain = domain;
                this.lightningAddressType = addressType;
                this.zeusPlusExpiresAt = plusExpiresAt;
                this.serviceDeviceToken = deviceToken;
                if (handle && domain) {
                    this.lightningAddress = `${handle}@${domain}`;
                }

                if (
                    this.lightningAddress &&
                    this.localHashes === 0 &&
                    this.lightningAddressType === 'zaplocker'
                ) {
                    this.generatePreimages(true);
                } else if (
                    this.lightningAddress &&
                    new BigNumber(this.availableHashes).lt(50) &&
                    this.lightningAddressType === 'zaplocker'
                ) {
                    this.generatePreimages();
                }
            });

            return { results };
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.loading = false;
                this.error = true;
                this.error_msg = error_msg;
            });
            throw error;
        }
    };

    @action
    private redeemZaplocker = async (
        hash: string,
        payReq?: string,
        preimageNotFound?: boolean
    ) => {
        if (preimageNotFound) {
            this.error = true;
            this.error_msg = localeString(
                'stores.LightningAddressStore.preimageNotFound'
            );
            return;
        }

        this.error = false;
        this.error_msg = '';
        this.redeeming = true;

        try {
            const { verification, signature } = await this.getAuthData();

            const redeemResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/redeem`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature,
                    hash,
                    payReq
                })
            );

            const redeemData = redeemResponse.json();
            if (redeemResponse.info().status !== 200 || !redeemData.success) {
                throw redeemData.error;
            }

            this.redeeming = false;
            await this.deleteHash(hash);
            return { success: redeemData.success };
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.redeeming = false;
                this.error = true;
                this.error_msg = error_msg;
            });
            throw error;
        }
    };

    @action
    public redeemCashu = async (
        quote_id: string,
        mint_url: string,
        amount_msat: number,
        skipStatus?: boolean,
        localNotification?: boolean
    ) => {
        this.error = false;
        this.error_msg = '';
        this.redeeming = true;

        const fireLocalNotification = () => {
            const value = (amount_msat / 1000).toString();
            const value_commas = value.replace(
                /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g,
                ','
            );

            const title = 'ZEUS Nuts payment received!';
            const body = `Payment of ${value_commas} ${
                value_commas === '1' ? 'sat' : 'sats'
            } automatically accepted`;
            if (Platform.OS === 'android') {
                // @ts-ignore:next-line
                Notifications.postLocalNotification({
                    title,
                    body
                });
            }

            if (Platform.OS === 'ios') {
                // @ts-ignore:next-line
                Notifications.postLocalNotification({
                    title,
                    body,
                    sound: 'chime.aiff'
                });
            }
        };

        try {
            const response = await this.cashuStore.checkInvoicePaid(
                quote_id,
                mint_url,
                true
            );

            if (
                response?.isPaid ||
                response?.updatedInvoice?.state === 'ISSUED'
            ) {
                try {
                    const { verification, signature } =
                        await this.getAuthData();

                    const redeemResponse = await ReactNativeBlobUtil.fetch(
                        'POST',
                        `${LNURL_HOST}/lnurl/nuts/redeem`,
                        { 'Content-Type': 'application/json' },
                        JSON.stringify({
                            pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                            message: verification,
                            signature,
                            quoteId: quote_id
                        })
                    );

                    const redeemData = redeemResponse.json();
                    if (
                        redeemResponse.info().status !== 200 ||
                        !redeemData.success
                    ) {
                        throw redeemData.error;
                    }

                    this.redeeming = false;

                    if (localNotification) fireLocalNotification();
                    if (!skipStatus) this.status(true);
                    return true;
                } catch (error) {
                    const error_msg = error?.toString();
                    runInAction(() => {
                        this.redeeming = false;
                        this.error = true;
                        this.error_msg = error_msg;
                    });
                    throw error;
                }
            } else {
                runInAction(() => {
                    this.redeeming = false;
                    this.error = true;
                    this.error_msg = localeString(
                        'stores.LightningAddressStore.Cashu.quoteNotPaid'
                    );
                });
                return true;
            }
        } catch (e) {
            runInAction(() => {
                this.redeeming = false;
                this.error = true;
                this.error_msg = localeString(
                    'stores.LightningAddressStore.Cashu.quotePaymentErr'
                );
            });
            return true;
        }
    };

    @action
    public lookupAttestations = async (hash: string, amountMsat: number) => {
        const attestations: any = [];
        let status = 'warning';

        try {
            const attestationEvents: any = {};

            const hashpk = getPublicKey(hash);

            await Promise.all(
                this.settingsStore.settings.lightningAddress.nostrRelays.map(
                    async (relayItem) => {
                        const relay = relayInit(relayItem);
                        relay.on('connect', () => {
                            console.log(`connected to ${relay.url}`);
                        });
                        relay.on('error', () => {
                            console.log(`failed to connect to ${relay.url}`);
                        });

                        await relay.connect();

                        const events = await relay.list([
                            {
                                kinds: [55869],
                                '#p': [hashpk]
                            }
                        ]);

                        events.map((event: any) => {
                            attestationEvents[event.id] = event;
                        });

                        relay.close();
                        return;
                    }
                )
            );

            Object.keys(attestationEvents).map((key) => {
                const attestation = this.analyzeAttestation(
                    attestationEvents[key],
                    hash,
                    amountMsat
                );
                attestations.push(attestation);
            });

            if (attestations.length === 1) {
                const attestation = attestations[0];
                if (attestation.isValid) {
                    status = 'success';
                } else {
                    status = 'error';
                }
            }
            if (attestations.length > 1) status = 'error';
        } catch (e) {
            console.log('attestation lookup error', e);
        }

        return {
            attestations,
            status
        };
    };

    private calculateFeeMsat = (amountMsat: string | number) => {
        let feeMsat;
        for (let i = this.fees.length - 1; i >= 0; i--) {
            const feeItem = this.fees[i];
            const { limitAmount, limitQualifier, fee, feeQualifier } = feeItem;

            let match;
            if (limitQualifier === 'lt') {
                match = new BigNumber(amountMsat).div(1000).lt(limitAmount);
            } else if (limitQualifier === 'lte') {
                match = new BigNumber(amountMsat).div(1000).lte(limitAmount);
            } else if (limitQualifier === 'gt') {
                match = new BigNumber(amountMsat).div(1000).gt(limitAmount);
            } else if (limitQualifier === 'gte') {
                match = new BigNumber(amountMsat).div(1000).gte(limitAmount);
            }

            if (match) {
                if (feeQualifier === 'fixedSats') {
                    feeMsat = fee * 1000;
                } else if (feeQualifier === 'percentage') {
                    feeMsat = Number(
                        new BigNumber(amountMsat).times(fee).div(100)
                    );
                }
            }
        }

        if (feeMsat) {
            return feeMsat;
        } else {
            // return 250 sat fee in case of error
            return 250000;
        }
    };

    private analyzeAttestation = (
        attestation: any,
        hash: string,
        amountMsat: string | number
    ) => {
        const { content } = attestation;

        // defaults
        attestation.isValid = false;
        attestation.isValidLightningInvoice = false;
        attestation.isHashValid = false;
        attestation.isAmountValid = false;

        try {
            const decoded: any = bolt11.decode(content);
            for (let i = 0; i < decoded.tags.length; i++) {
                const tag = decoded.tags[i];
                switch (tag.tagName) {
                    case 'payment_hash':
                        decoded.payment_hash = tag.data;
                        break;
                }
            }

            attestation.isValidLightningInvoice = true;

            if (decoded.payment_hash === hash) {
                attestation.isHashValid = true;
            }

            if (decoded.millisatoshis) {
                attestation.millisatoshis = decoded.millisatoshis;
                attestation.feeMsat = this.calculateFeeMsat(
                    decoded.millisatoshis
                );

                if (
                    new BigNumber(amountMsat)
                        .plus(attestation.feeMsat)
                        .isEqualTo(decoded.millisatoshis)
                ) {
                    attestation.isAmountValid = true;
                }
            }

            if (
                attestation.isValidLightningInvoice &&
                attestation.isHashValid &&
                attestation.isAmountValid
            ) {
                attestation.isValid = true;
            }
        } catch (e) {
            console.log('analyzeAttestation decode error', e);
        }

        return attestation;
    };

    public setDeviceToken = (token: string) =>
        (this.currentDeviceToken = token);

    public updatePushCredentials = async () => {
        // only push update if the device token has changed
        if (
            this.currentDeviceToken &&
            (!this.serviceDeviceToken ||
                this.currentDeviceToken !== this.serviceDeviceToken)
        ) {
            this.update({
                device_token: this.currentDeviceToken,
                device_platform: Platform.OS
            });
        }
    };

    @action
    public lookupPreimageAndRedeemZaplocker = async (
        hash: string,
        amount_msat: number,
        comment?: string,
        skipStatus?: boolean,
        localNotification?: boolean
    ) => {
        return await this.getPreimageMap().then(async (map) => {
            const preimage = map[hash];
            const preimageNotFound = !preimage;
            const value = (amount_msat / 1000).toString();
            const value_commas = value.replace(
                /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g,
                ','
            );

            const fireLocalNotification = () => {
                const title = 'ZEUS Pay payment received!';
                const body = `Payment of ${value_commas} ${
                    value_commas === '1' ? 'sat' : 'sats'
                } automatically accepted`;
                if (Platform.OS === 'android') {
                    // @ts-ignore:next-line
                    Notifications.postLocalNotification({
                        title,
                        body
                    });
                }

                if (Platform.OS === 'ios') {
                    // @ts-ignore:next-line
                    Notifications.postLocalNotification({
                        title,
                        body,
                        sound: 'chime.aiff'
                    });
                }
            };

            return await BackendUtils.createInvoice({
                // 24 hrs
                expiry: '86400',
                value_msat: amount_msat,
                memo: comment ? `ZEUS Pay: ${comment}` : 'ZEUS Pay',
                preimage,
                private:
                    this.settingsStore?.settings?.lightningAddress
                        ?.routeHints || false
            })
                .then((result: any) => {
                    if (result.payment_request) {
                        return this.redeemZaplocker(
                            hash,
                            result.payment_request,
                            preimageNotFound
                        ).then((success: any) => {
                            if (success?.success === true && localNotification)
                                fireLocalNotification();
                            if (!skipStatus) this.status(true);
                            return;
                        });
                    }
                })
                .catch(() => {
                    // first, try looking up invoice for redeem
                    try {
                        return BackendUtils.lookupInvoice({
                            r_hash: hash
                        }).then((result: any) => {
                            if (result.payment_request) {
                                return this.redeemZaplocker(
                                    hash,
                                    result.payment_request,
                                    preimageNotFound
                                ).then((success: any) => {
                                    if (
                                        success?.success === true &&
                                        localNotification
                                    )
                                        fireLocalNotification();
                                    if (!skipStatus) this.status(true);
                                    return;
                                });
                            }
                        });
                    } catch (e) {
                        // then, try to redeem without new pay req
                        return this.redeemZaplocker(
                            hash,
                            undefined,
                            preimageNotFound
                        ).then((success) => {
                            if (success?.success === true && localNotification)
                                fireLocalNotification();
                            if (!skipStatus) this.status(true);
                            return;
                        });
                    }
                });
        });
    };

    @action
    public redeemAllOpenPaymentsZaplocker = async (
        localNotification?: boolean
    ) => {
        this.redeemingAll = true;
        const attestationLevel = this.settingsStore?.settings?.lightningAddress
            ?.automaticallyAcceptAttestationLevel
            ? this.settingsStore.settings.lightningAddress
                  .automaticallyAcceptAttestationLevel
            : 2;

        // disabled
        if (attestationLevel === 0) {
            for (const item of this.paid) {
                await this.lookupPreimageAndRedeemZaplocker(
                    item.hash,
                    item.amount_msat,
                    item.comment,
                    true,
                    localNotification
                );
                return;
            }
        } else {
            for (const item of this.paid) {
                await this.lookupAttestations(item.hash, item.amount_msat)
                    .then(async ({ status }: { status?: string }) => {
                        if (status === 'error') return;
                        // success only
                        if (status === 'warning' && attestationLevel === 1)
                            return;
                        return await this.lookupPreimageAndRedeemZaplocker(
                            item.hash,
                            item.amount_msat,
                            item.comment,
                            true,
                            localNotification
                        );
                    })
                    .catch((e) => {
                        console.log('Error looking up attestation', e);
                    });
            }
        }
        runInAction(() => {
            this.status(true);
            this.redeemingAll = false;
        });
    };

    @action
    public redeemAllOpenPaymentsCashu = async (localNotification?: boolean) => {
        this.redeemingAll = true;

        for (const item of this.paid.slice().reverse()) {
            await this.redeemCashu(
                item.quote_id,
                item.mint_url,
                item.amount_msat,
                true,
                localNotification
            );
        }

        runInAction(() => {
            this.status(true);
            this.redeemingAll = false;
        });
    };

    private subscribeUpdatesZaplocker = async () => {
        const { verification, signature } = await this.getAuthData();

        this.socket = io(LNURL_SOCKET_HOST, {
            path: LNURL_SOCKET_PATH
        }).connect();
        this.socket.emit('auth', {
            pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
            message: verification,
            signature
        });

        this.socket.on('paid', (data: any) => {
            const { hash, amount_msat, comment } = data;

            const attestationLevel = this.settingsStore?.settings
                ?.lightningAddress?.automaticallyAcceptAttestationLevel
                ? this.settingsStore.settings.lightningAddress
                      .automaticallyAcceptAttestationLevel
                : 2;

            if (attestationLevel === 0) {
                this.lookupPreimageAndRedeemZaplocker(
                    hash,
                    amount_msat,
                    comment,
                    false,
                    true
                );
            } else {
                this.lookupAttestations(hash, amount_msat)
                    .then(({ status }: { status?: string }) => {
                        if (status === 'error') return;
                        // success only
                        if (status === 'warning' && attestationLevel === 1)
                            return;
                        this.lookupPreimageAndRedeemZaplocker(
                            hash,
                            amount_msat,
                            comment,
                            false,
                            true
                        );
                    })
                    .catch((e) =>
                        console.log('Error looking up attestation', e)
                    );
            }
        });
    };

    private subscribeUpdatesCashu = async () => {
        const { verification, signature } = await this.getAuthData();

        this.socket = io(LNURL_SOCKET_HOST, {
            path: LNURL_SOCKET_PATH
        }).connect();
        this.socket.emit('auth', {
            pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
            message: verification,
            signature
        });

        this.socket.on('paid', (data: any) => {
            const { quote_id, mint_url, amount_msat } = data;
            this.redeemCashu(quote_id, mint_url, amount_msat, false, true);
        });
    };

    public prepareToAutomaticallyAcceptZaplocker = async () => {
        this.readyToAutomaticallyAccept = false;
        this.prepareToAutomaticallyAcceptStart = true;

        while (!this.readyToAutomaticallyAccept) {
            const isReady =
                await this.nodeInfoStore.isLightningReadyToReceive();
            if (isReady) {
                runInAction(() => {
                    this.readyToAutomaticallyAccept = true;
                    if (this.socket && this.socket.connected) return;
                    this.redeemAllOpenPaymentsZaplocker(true);
                    this.subscribeUpdatesZaplocker();
                });
            }
            await sleep(3000);
        }
    };

    public prepareToAutomaticallyAcceptCashu = () => {
        if (this.socket && this.socket.connected) return;
        this.redeemAllOpenPaymentsCashu(true);
        this.subscribeUpdatesCashu();
    };

    @action
    public reset = () => {
        this.loading = false;
        this.error = false;
        this.error_msg = '';
        this.availableHashes = 0;
        this.localHashes = 0;
        this.paid = [];
        this.preimageMap = {};
        this.socket = undefined;
        this.lightningAddress = '';
        this.lightningAddressHandle = '';
        this.lightningAddressDomain = '';
        this.lightningAddressType = '';
        this.zeusPlusExpiresAt = undefined;
    };

    @action
    public deleteAddress = async () => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
            const { verification, signature } = await this.getAuthData();

            const deleteResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/delete`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature
                })
            );

            const deleteData = deleteResponse.json();
            if (deleteResponse.info().status !== 200) throw deleteData.error;

            // Clear local storage and reset store state
            await Storage.setItem(ADDRESS_ACTIVATED_STRING, false);
            await Storage.setItem(HASHES_STORAGE_STRING, '');
            this.reset();

            runInAction(() => {
                this.loading = false;
            });

            return true;
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.error = true;
                this.error_msg = error_msg || 'Failed to delete account';
                this.loading = false;
            });
            throw error;
        }
    };

    @action
    public createZeusPayPlusOrder = async () => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
            const { verification, signature } = await this.getAuthData();

            const orderResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/plus/order`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature
                })
            );

            const orderData = orderResponse.json();
            if (orderResponse.info().status !== 200) throw orderData.error;

            runInAction(() => {
                this.loading = false;
            });

            return orderData;
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.error = true;
                this.error_msg = error_msg || 'Failed to create order';
                this.loading = false;
            });
            throw error;
        }
    };
}
