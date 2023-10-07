import { Platform } from 'react-native';
import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import EncryptedStorage from 'react-native-encrypted-storage';
import bolt11 from 'bolt11';
import { io } from 'socket.io-client';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex } from '@noble/hashes/utils';

import {
    relayInit,
    finishEvent,
    generatePrivateKey,
    getPublicKey
} from 'nostr-tools';

const bip39 = require('bip39');

import { sha256 } from 'js-sha256';

import NodeInfoStore from './NodeInfoStore';
import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import BigNumber from 'bignumber.js';

const LNURL_HOST =
    Platform.OS === 'ios' ? 'http://localhost:1337' : 'http://10.0.2.2:1337';
const LNURL_SOCKET_HOST =
    Platform.OS === 'ios' ? 'http://localhost:8000' : 'http://10.0.2.2:8000';

const ADDRESS_ACTIVATED_STRING = 'olympus-lightning-address';
const HASHES_STORAGE_STRING = 'olympus-lightning-address-hashes';

const RELAYS = ['wss://nostr.mutinywallet.com', 'wss://relay.damus.io'];

export default class LightningAddressStore {
    @observable public lightningAddressHandle: string;
    @observable public lightningAddressDomain: string;
    @observable public lightningAddressActivated: boolean = false;
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public error_msg: string = '';
    @observable public availableHashes: number = 0;
    @observable public paid: any = [];
    @observable public settled: any = [];
    @observable public preimageMap: any = {};
    @observable public fees: any = {};
    @observable public minimumSats: number;
    @observable public socket: any;
    // Push
    @observable public deviceToken: string;

    nodeInfoStore: NodeInfoStore;
    settingsStore: SettingsStore;

    constructor(nodeInfoStore: NodeInfoStore, settingsStore: SettingsStore) {
        this.nodeInfoStore = nodeInfoStore;
        this.settingsStore = settingsStore;
    }

    @action
    public getPreimageMap = async () => {
        this.loading = true;
        const map = await EncryptedStorage.getItem(HASHES_STORAGE_STRING);

        if (map) {
            this.preimageMap = JSON.parse(map);
            this.loading = false;
            return this.preimageMap;
        } else {
            this.loading = false;
        }
    };

    @action
    public getLightningAddressActivated = async () => {
        this.loading = true;
        const lightningAddressActivated = await EncryptedStorage.getItem(
            ADDRESS_ACTIVATED_STRING
        );

        if (lightningAddressActivated) {
            this.lightningAddressActivated = Boolean(lightningAddressActivated);
            this.loading = false;
            return this.lightningAddressActivated;
        } else {
            this.loading = false;
        }
    };

    setLightningAddress = async (handle: string, domain: string) => {
        await EncryptedStorage.setItem(ADDRESS_ACTIVATED_STRING, 'true');
        this.lightningAddressActivated = true;
        this.lightningAddressHandle = handle;
        this.lightningAddressDomain = domain;
    };

    @action
    public generatePreimages = async () => {
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

        const hashesString = await EncryptedStorage.getItem(
            HASHES_STORAGE_STRING
        );

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

        await EncryptedStorage.setItem(
            HASHES_STORAGE_STRING,
            JSON.stringify(newHashes)
        );

        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/auth`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                })
            )
                .then((response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        const data = response.json();
                        const { verification } = data;

                        BackendUtils.signMessage(verification)
                            .then((data: any) => {
                                const signature = data.zbase || data.signature;
                                ReactNativeBlobUtil.fetch(
                                    'POST',
                                    `${LNURL_HOST}/lnurl/submitHashes`,
                                    {
                                        'Content-Type': 'application/json'
                                    },
                                    JSON.stringify(
                                        nostrSignatures.length > 0
                                            ? {
                                                  pubkey: this.nodeInfoStore
                                                      .nodeInfo.identity_pubkey,
                                                  message: verification,
                                                  signature,
                                                  hashes,
                                                  nostrSignatures
                                              }
                                            : {
                                                  pubkey: this.nodeInfoStore
                                                      .nodeInfo.identity_pubkey,
                                                  message: verification,
                                                  signature,
                                                  hashes
                                              }
                                    )
                                )
                                    .then(async (response: any) => {
                                        const data = response.json();
                                        const { created_at, success } = data;

                                        if (status === 200 && success) {
                                            this.loading = false;
                                            resolve({
                                                created_at
                                            });

                                            this.status();
                                        } else {
                                            this.loading = false;
                                            this.error = true;
                                            this.error_msg =
                                                data.error.toString();
                                            reject(data.error);
                                        }
                                    })
                                    .catch((error: any) => {
                                        this.loading = false;
                                        this.error = true;
                                        this.error_msg = error.toString();
                                        reject(error);
                                    });
                            })
                            .catch((error: any) => {
                                this.loading = false;
                                this.error = true;
                                this.error_msg = error.toString();
                                reject(error);
                            });
                    }
                })
                .catch((error: any) => {
                    this.loading = false;
                    this.error = true;
                    this.error_msg = error.toString();
                    reject(error);
                });
        });
    };

    @action
    public create = async (
        handle: string,
        nostr_pk?: string,
        nostrPrivateKey?: string,
        relays?: Array<string>
    ) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/auth`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                })
            )
                .then((response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        const data = response.json();
                        const { verification } = data;

                        BackendUtils.signMessage(verification)
                            .then((data: any) => {
                                const signature = data.zbase || data.signature;
                                ReactNativeBlobUtil.fetch(
                                    'POST',
                                    `${LNURL_HOST}/lnurl/create`,
                                    {
                                        'Content-Type': 'application/json'
                                    },
                                    JSON.stringify({
                                        pubkey: this.nodeInfoStore.nodeInfo
                                            .identity_pubkey,
                                        message: verification,
                                        signature,
                                        handle,
                                        domain: 'zeuspay.com',
                                        nostr_pk,
                                        relays
                                    })
                                )
                                    .then(async (response: any) => {
                                        const data = response.json();
                                        const status = response.info().status;
                                        const {
                                            handle,
                                            domain,
                                            created_at,
                                            success
                                        } = data;

                                        if (status === 200 && success) {
                                            if (handle) {
                                                this.setLightningAddress(
                                                    handle,
                                                    domain
                                                );
                                            }

                                            await this.settingsStore.updateSettings(
                                                {
                                                    lightningAddress: {
                                                        enabled: true,
                                                        automaticallyAccept:
                                                            true,
                                                        automaticallyRequestOlympusChannels:
                                                            true,
                                                        allowComments: true,
                                                        nostrPrivateKey,
                                                        nostrRelays: relays,
                                                        notifications: 1
                                                    }
                                                }
                                            );

                                            this.loading = false;
                                            resolve({
                                                created_at
                                            });
                                        } else {
                                            this.loading = false;
                                            this.error = true;
                                            this.error_msg =
                                                data.error.toString();
                                            reject(data.error);
                                        }
                                    })
                                    .catch((error: any) => {
                                        this.loading = false;
                                        this.error = true;
                                        this.error_msg = error.toString();
                                        reject(error);
                                    });
                            })
                            .catch((error: any) => {
                                this.loading = false;
                                this.error = true;
                                this.error_msg = error.toString();
                                reject(error);
                            });
                    }
                })
                .catch((error: any) => {
                    this.loading = false;
                    this.error = true;
                    this.error_msg = error.toString();
                    reject(error);
                });
        });
    };

    @action
    public update = (updates: any) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/auth`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                })
            )
                .then((response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        const data = response.json();
                        const { verification } = data;

                        BackendUtils.signMessage(verification)
                            .then((data: any) => {
                                const signature = data.zbase || data.signature;
                                ReactNativeBlobUtil.fetch(
                                    'POST',
                                    `${LNURL_HOST}/lnurl/update`,
                                    {
                                        'Content-Type': 'application/json'
                                    },
                                    JSON.stringify({
                                        pubkey: this.nodeInfoStore.nodeInfo
                                            .identity_pubkey,
                                        message: verification,
                                        signature,
                                        updates
                                    })
                                )
                                    .then((response: any) => {
                                        const data = response.json();
                                        const status = response.info().status;
                                        const {
                                            handle,
                                            domain,
                                            created_at,
                                            success
                                        } = data;

                                        if (status === 200 && success) {
                                            if (handle) {
                                                this.setLightningAddress(
                                                    handle,
                                                    domain || 'zeuspay.com'
                                                );
                                            }

                                            this.loading = false;
                                            resolve({
                                                created_at
                                            });
                                        } else {
                                            this.loading = false;
                                            this.error = true;
                                            this.error_msg =
                                                data.error.toString();
                                            reject(data.error);
                                        }
                                    })
                                    .catch((error: any) => {
                                        this.loading = false;
                                        this.error = true;
                                        this.error_msg = error.toString();
                                        reject(error);
                                    });
                            })
                            .catch((error: any) => {
                                this.loading = false;
                                this.error = true;
                                this.error_msg = error.toString();
                                reject(error);
                            });
                    }
                })
                .catch((error: any) => {
                    this.loading = false;
                    this.error = true;
                    this.error_msg = error.toString();
                    reject(error);
                });
        });
    };

    @action
    public status = async () => {
        this.loading = true;
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/auth`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                })
            )
                .then((response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        const data = response.json();
                        const { verification } = data;

                        BackendUtils.signMessage(verification)
                            .then((data: any) => {
                                const signature = data.zbase || data.signature;
                                ReactNativeBlobUtil.fetch(
                                    'POST',
                                    `${LNURL_HOST}/lnurl/status`,
                                    {
                                        'Content-Type': 'application/json'
                                    },
                                    JSON.stringify({
                                        pubkey: this.nodeInfoStore.nodeInfo
                                            .identity_pubkey,
                                        message: verification,
                                        signature
                                    })
                                )
                                    .then(async (response: any) => {
                                        const data = response.json();
                                        const {
                                            results,
                                            success,
                                            paid,
                                            settled,
                                            fees,
                                            minimumSats,
                                            handle,
                                            domain
                                        } = data;

                                        if (status === 200 && success) {
                                            this.error = false;
                                            this.error_msg = '';
                                            this.loading = false;
                                            this.availableHashes = results || 0;
                                            this.paid = paid;
                                            this.settled = settled;
                                            this.fees = fees;
                                            this.minimumSats = minimumSats;
                                            this.lightningAddressHandle =
                                                handle;
                                            this.lightningAddressDomain =
                                                domain;

                                            if (
                                                this.lightningAddressHandle &&
                                                new BigNumber(
                                                    this.availableHashes
                                                ).lt(50)
                                            ) {
                                                this.generatePreimages();
                                            }
                                            resolve({
                                                results
                                            });
                                        } else {
                                            this.loading = false;
                                            this.error = true;
                                            this.error_msg =
                                                data.error.toString();
                                            reject(data.error);
                                        }
                                    })
                                    .catch((error: any) => {
                                        this.loading = false;
                                        this.error = true;
                                        this.error_msg = error.toString();
                                        reject(error);
                                    });
                            })
                            .catch((error: any) => {
                                this.loading = false;
                                this.error = true;
                                this.error_msg = error.toString();
                                reject(error);
                            });
                    }
                })
                .catch((error: any) => {
                    this.loading = false;
                    this.error = true;
                    this.error_msg = error.toString();
                    reject(error);
                });
        });
    };

    @action
    public redeem = async (hash: string, payReq?: string) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/auth`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                })
            )
                .then((response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        const data = response.json();
                        const { verification } = data;

                        BackendUtils.signMessage(verification)
                            .then((data: any) => {
                                const signature = data.zbase || data.signature;
                                ReactNativeBlobUtil.fetch(
                                    'POST',
                                    `${LNURL_HOST}/lnurl/redeem`,
                                    {
                                        'Content-Type': 'application/json'
                                    },
                                    JSON.stringify({
                                        pubkey: this.nodeInfoStore.nodeInfo
                                            .identity_pubkey,
                                        message: verification,
                                        signature,
                                        hash,
                                        payReq
                                    })
                                )
                                    .then(async (response: any) => {
                                        const data = response.json();
                                        const { success } = data;

                                        if (status === 200 && success) {
                                            this.loading = false;

                                            resolve({
                                                success
                                            });
                                        } else {
                                            this.loading = false;
                                            this.error = true;
                                            this.error_msg =
                                                data.error.toString();
                                            reject(data.error);
                                        }
                                    })
                                    .catch((error: any) => {
                                        this.loading = false;
                                        this.error = true;
                                        this.error_msg = error.toString();
                                        reject(error);
                                    });
                            })
                            .catch((error: any) => {
                                this.loading = false;
                                this.error = true;
                                this.error_msg = error.toString();
                                reject(error);
                            });
                    }
                })
                .catch((error: any) => {
                    this.loading = false;
                    this.error = true;
                    this.error_msg = error.toString();
                    reject(error);
                });
        });
    };

    @action
    public broadcastAttestation = async (hash: string, invoice: string) => {
        // create ephemeral key
        const sk = generatePrivateKey();
        const pk = getPublicKey(sk);

        const event = {
            kind: 55869,
            pubkey: pk,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', hash]],
            content: invoice
        };

        // this calculates the event id and signs the event in a single step
        const signedEvent = finishEvent(event, sk);

        console.log('signedEvent', signedEvent);

        await Promise.all(
            RELAYS.map(async (relayItem) => {
                const relay = relayInit(relayItem);
                relay.on('connect', () => {
                    console.log(`connected to ${relay.url}`);
                });
                relay.on('error', () => {
                    console.log(`failed to connect to ${relay.url}`);
                });

                await relay.connect();

                await relay.publish(signedEvent);

                console.log('event.id', signedEvent.id);
                const eventReceived = await relay.get({
                    ids: [signedEvent.id]
                });
                console.log('eventReceived', eventReceived);
                return;
            })
        );

        console.log('broadcast complete');
        return;
    };

    @action
    public lookupAttestations = async (hash: string, amountMsat: number) => {
        const attestations: any = {};

        await Promise.all(
            RELAYS.map(async (relayItem) => {
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
                        '#p': [hash]
                    }
                ]);

                events.map((event) => {
                    attestations[event.id] = event;
                });

                relay.close();
                return;
            })
        );

        const attestationsArray: any = [];
        Object.keys(attestations).map((key) => {
            const attestation = this.analyzeAttestation(
                attestations[key],
                hash,
                amountMsat
            );
            attestationsArray.push(attestation);
        });

        return attestationsArray;
    };

    calculateFeeMsat = (amountMsat: string | number) => {
        for (let i = 0; i < this.fees.length; i++) {
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
                    return fee * 1000;
                } else if (feeQualifier === 'percentage') {
                    return Number(
                        new BigNumber(amountMsat).times(fee).div(100)
                    );
                }
            }
        }

        // return 100 sat fee in case of error
        return 100000;
    };

    analyzeAttestation = (
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

    @action
    public setDeviceToken = (token: string) => {
        this.deviceToken = token;
    };

    @action
    public updatePushCredentials = async () => {
        const DEVICE_TOKEN_KEY = 'zeus-device-notification-token';
        const token = await EncryptedStorage.getItem(DEVICE_TOKEN_KEY);

        // only push update if the device token has changed
        if (this.deviceToken && (!token || this.deviceToken !== token)) {
            this.update({
                device_token: this.deviceToken,
                device_platform: Platform.OS
            }).then(async () => {
                await EncryptedStorage.setItem(
                    DEVICE_TOKEN_KEY,
                    this.deviceToken
                );
            });
        }
    };

    @action
    public subscribeUpdates = () => {
        if (this.socket) return;
        ReactNativeBlobUtil.fetch(
            'POST',
            `${LNURL_HOST}/lnurl/auth`,
            {
                'Content-Type': 'application/json'
            },
            JSON.stringify({
                pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
            })
        ).then((response: any) => {
            const status = response.info().status;
            if (status == 200) {
                const data = response.json();
                const { verification } = data;

                BackendUtils.signMessage(verification).then((data: any) => {
                    const signature = data.zbase || data.signature;

                    this.socket = io.connect(LNURL_SOCKET_HOST);
                    this.socket.emit('auth', {
                        pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                        message: verification,
                        signature
                    });

                    this.socket.on('paid', (data: any) => {
                        console.log('paid', data);
                        const { hash, req, amount_msat } = data;

                        console.log('hash', hash);
                        console.log('req', req);
                        console.log('amount_msat', amount_msat);

                        this.getPreimageMap().then((map) => {
                            const preimage = map[hash];

                            BackendUtils.createInvoice({
                                expiry: '3600',
                                value: (amount_msat / 1000).toString(),
                                memo: 'ZEUS PAY',
                                preimage
                            })
                                .then((result: any) => {
                                    if (result.payment_request) {
                                        this.redeem(
                                            hash,
                                            result.payment_request
                                        ).then(() => this.status());
                                    }
                                })
                                .catch(() => {
                                    // if payment request has already been submitted, try to redeem without new pay req
                                    this.redeem(hash).then(() => this.status());
                                });
                        });
                    });
                });
            }
        });
    };

    @action
    public reset = () => {
        this.loading = false;
        this.error = false;
        this.error_msg = '';
        this.availableHashes = 0;
        this.paid = [];
        this.settled = [];
        this.preimageMap = {};
        this.socket = undefined;
    };
}
