import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import EncryptedStorage from 'react-native-encrypted-storage';

const bip39 = require('bip39');

import { sha256 } from 'js-sha256';

import NodeInfoStore from './NodeInfoStore';
import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import BigNumber from 'bignumber.js';

const LNURL_HOST = 'http://10.0.2.2:1337';
const ADDRESS_STORAGE_STRING = 'olympus-lightning-address';
const HASHES_STORAGE_STRING = 'olympus-lightning-address-hashes';

export default class LightningAddressStore {
    @observable public lightningAddress: string;
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public error_msg: string = '';
    @observable public availableHashes: number = 0;
    @observable public paid: any = [];
    @observable public settled: any = [];
    @observable public preimageMap: any = {};
    @observable public fees: any = {};
    @observable public minimumSats: number;

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
    public getLightningAddress = async () => {
        this.loading = true;
        const lightningAddress = await EncryptedStorage.getItem(
            ADDRESS_STORAGE_STRING
        );

        if (lightningAddress) {
            this.lightningAddress = lightningAddress;
            this.loading = false;
            return this.lightningAddress;
        } else {
            this.loading = false;
        }
    };

    // TODO remove
    test_DELETE = async () => {
        await EncryptedStorage.setItem(ADDRESS_STORAGE_STRING, '');
    };

    setLightningAddress = async (handle: string) => {
        const lightningAddress = await EncryptedStorage.getItem(
            ADDRESS_STORAGE_STRING
        );

        if (lightningAddress) {
            this.lightningAddress = lightningAddress;
            return;
        }

        const newAddress = `${handle}@lnolymp.us`;

        await EncryptedStorage.setItem(ADDRESS_STORAGE_STRING, newAddress);

        this.lightningAddress = newAddress;
    };

    @action
    public generatePreimages = async () => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        const preimageHashMap: any = {};

        const preimages = [];
        for (let i = 0; i < 1000; i++) {
            preimages.push(
                bip39.mnemonicToEntropy(bip39.generateMnemonic(256))
            );
        }

        const hashes: any = [];
        if (preimages) {
            for (let i = 0; i < preimages.length; i++) {
                const preimage = preimages[i];
                const hash = sha256
                    .create()
                    .update(Base64Utils.hexToUint8Array(preimage))
                    .hex();
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
                                    JSON.stringify({
                                        pubkey: this.nodeInfoStore.nodeInfo
                                            .identity_pubkey,
                                        message: verification,
                                        signature,
                                        hashes
                                    })
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
    public create = async (handle: string) => {
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
                                        handle
                                    })
                                )
                                    .then(async (response: any) => {
                                        const data = response.json();
                                        const { handle, created_at, success } =
                                            data;

                                        if (handle) {
                                            this.setLightningAddress(handle);
                                        }

                                        if (status === 200 && success) {
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
                                            minimumSats
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

                                            if (
                                                new BigNumber(
                                                    this.availableHashes
                                                ).lt(500)
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
    public redeem = async (hash: string, payReq: string) => {
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
    public reset = () => {
        this.loading = false;
        this.error = false;
        this.error_msg = '';
        this.availableHashes = 0;
        this.paid = [];
        this.settled = [];
        this.preimageMap = {};
    };
}
