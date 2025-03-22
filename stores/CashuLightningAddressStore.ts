import { Platform } from 'react-native';
import { action, observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { io } from 'socket.io-client';
import { Notifications } from 'react-native-notifications';

import CashuStore from './CashuStore';
import NodeInfoStore from './NodeInfoStore';
import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';

import Storage from '../storage';

const LNURL_HOST = 'https://zeusnuts.com/api';
const LNURL_SOCKET_HOST = 'https://zeusnuts.com';
const LNURL_SOCKET_PATH = '/stream';

export const ADDRESS_ACTIVATED_STRING = 'zeusnuts-lightning-address';

export default class CashuLightningAddressStore {
    @observable public cashuLightningAddress: string;
    @observable public cashuLightningAddressHandle: string;
    @observable public cashuLightningAddressDomain: string;
    @observable public cashuLightningAddressActivated: boolean = false;
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
    @observable public deviceToken: string;

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

    private setLightningAddress = async (handle: string, domain: string) => {
        await Storage.setItem(ADDRESS_ACTIVATED_STRING, true);
        runInAction(() => {
            this.cashuLightningAddressActivated = true;
            this.cashuLightningAddressHandle = handle;
            this.cashuLightningAddressDomain = domain;
            this.cashuLightningAddress = `${handle}@${domain}`;
        });
    };

    @action
    public create = async (handle: string, mint_url: string) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
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
                    handle,
                    domain: 'zeusnuts.com',
                    mint_url
                })
            );

            const createData = createResponse.json();
            if (createResponse.info().status !== 200 || !createData.success) {
                throw createData.error;
            }

            const { handle: responseHandle, domain, created_at } = createData;

            if (responseHandle) {
                this.setLightningAddress(responseHandle, domain);
            }

            await this.settingsStore.updateSettings({
                cashuLightningAddress: {
                    enabled: true,
                    automaticallyAccept: true
                }
            });

            // TODO
            // runInAction(() => {
            //     // ensure push credentials are in place
            //     // right after creation
            //     this.updatePushCredentials();
            //     this.loading = false;
            // });

            return { created_at };
        } catch (error) {
            console.log('!!!create', error);
            this.error_msg = error?.toString();
            runInAction(() => {
                this.loading = false;
                this.error = true;
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

            const updateResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/lnurl/update`,
                { 'Content-Type': 'application/json' },
                JSON.stringify({
                    pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                    message: verification,
                    signature,
                    updates
                })
            );

            const updateData = updateResponse.json();
            if (updateResponse.info().status !== 200 || !updateData.success) {
                throw updateData.error;
            }

            const { handle, domain, created_at } = updateData;

            if (handle) {
                this.setLightningAddress(handle, domain || 'zeuspay.com');
            }

            this.loading = false;
            return { created_at };
        } catch (error) {
            runInAction(() => {
                this.loading = false;
                this.error = true;
                this.error_msg = error?.toString();
            });
            throw error;
        }
    };

    @action
    public status = async (isRedeem?: boolean) => {
        this.loading = true;

        try {
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

            const { results, paid, fees, minimumSats, handle, domain } =
                statusData;

            runInAction(() => {
                if (!isRedeem) {
                    this.error = false;
                    this.error_msg = '';
                }
                this.loading = false;
                this.availableHashes = results || 0;
            });

            runInAction(() => {
                this.paid = paid;
                this.fees = fees;
                this.minimumSats = minimumSats;
                this.cashuLightningAddressHandle = handle;
                this.cashuLightningAddressDomain = domain;
                if (handle && domain) {
                    this.cashuLightningAddress = `${handle}@${domain}`;
                }
            });

            return { results };
        } catch (error) {
            runInAction(() => {
                this.error_msg = localeString('error.serviceConnection');
                this.loading = false;
                this.error = true;
            });
            throw error;
        }
    };

    @action
    public redeem = async (
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

            if (response?.isPaid) {
                try {
                    const authResponse = await ReactNativeBlobUtil.fetch(
                        'POST',
                        `${LNURL_HOST}/lnurl/auth`,
                        { 'Content-Type': 'application/json' },
                        JSON.stringify({
                            pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey
                        })
                    );

                    const authData = authResponse.json();
                    if (authResponse.info().status !== 200)
                        throw authData.error;

                    const { verification } = authData;
                    const signData = await BackendUtils.signMessage(
                        verification
                    );
                    const signature = signData.zbase || signData.signature;

                    const redeemResponse = await ReactNativeBlobUtil.fetch(
                        'POST',
                        `${LNURL_HOST}/lnurl/redeem`,
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
                } catch (error) {
                    this.error_msg = error?.toString();
                    runInAction(() => {
                        this.redeeming = false;
                        this.error = true;
                    });
                    throw error;
                }
            } else {
                runInAction(() => {
                    this.redeeming = false;
                    this.error = true;
                    this.error_msg = 'Quote not paid.';
                });
            }
        } catch (e) {
            this.redeeming = false;
            this.error = true;
            this.error_msg = 'Error checking for quote payment.';
        }
    };

    @action
    public redeemAllOpenPayments = async (localNotification?: boolean) => {
        this.redeemingAll = true;

        for (const item of this.paid) {
            return await this.redeem(
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

    private subscribeUpdates = () => {
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
                        this.redeem(
                            quote_id,
                            mint_url,
                            amount_msat,
                            false,
                            true
                        );
                    });
                });
            }
        });
    };

    public prepareToAutomaticallyAccept = () => {
        if (this.socket && this.socket.connected) return;
        this.redeemAllOpenPayments(true);
        this.subscribeUpdates();
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
        this.cashuLightningAddress = '';
        this.cashuLightningAddressHandle = '';
        this.cashuLightningAddressDomain = '';
    };

    @action
    public deleteAddress = async () => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
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
            this.reset();

            runInAction(() => {
                this.loading = false;
            });

            return true;
        } catch (error) {
            runInAction(() => {
                this.error = true;
                this.error_msg =
                    error?.toString() || 'Failed to delete account';
                this.loading = false;
            });
            throw error;
        }
    };
}
