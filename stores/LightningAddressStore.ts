import { Platform } from 'react-native';
import { action, observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Notifications } from 'react-native-notifications';

import { io } from 'socket.io-client';

import CashuStore from './CashuStore';
import NodeInfoStore from './NodeInfoStore';
import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';

import Storage from '../storage';

const LNURL_HOST = 'https://zeuspay.com';
const LNURL_SOCKET_PATH = '/stream';

export const LEGACY_ADDRESS_ACTIVATED_STRING = 'olympus-lightning-address';
export const LEGACY_HASHES_STORAGE_STRING = 'olympus-lightning-address-hashes';

export const ADDRESS_ACTIVATED_STRING = 'zeuspay-lightning-address';
// Preimages left on the device by retired Zaplocker addresses. Nothing reads
// them anymore; the key is kept so address deletion and data wipes clear it.
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

interface Perk {
    title: string;
    note?: string;
    value?: string;
    links?: PerkLink[];
    comingSoon?: boolean;
}

interface PerkLink {
    title: string;
    url: string;
}

export default class LightningAddressStore {
    @observable public lightningAddress: string;
    @observable public lightningAddressHandle: string;
    @observable public lightningAddressDomain: string;
    @observable public lightningAddressType: string;
    @observable public lightningAddressActivated: boolean = false;
    @observable public noffer: string | null = null;
    @observable public zeusPlusExpiresAt: any;
    @observable public zeusPlusAnnualFeeSats: any;
    @observable public zeusPlusDiscount: any;
    @observable public legacyAccount: boolean = false;
    @observable public perks: Perk[] = [];
    @observable public image: string | null = null;
    @observable public bio: string | null = null;
    @observable public loading: boolean = false;
    @observable public redeeming: boolean = false;
    @observable public redeemingAll: boolean = false;
    @observable public error: boolean = false;
    @observable public error_msg: string | undefined;
    @observable public paid: any = [];
    @observable public minimumSats: number;
    @observable public socket: any;
    // Push
    @observable public currentDeviceToken: string;
    @observable public serviceDeviceToken: string;
    private pendingPushUpdate: boolean = false;
    // Auth
    auth?: Auth;
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

        if (this.auth && this.authDate && this.authDate > tenMinutesAgo) {
            return this.auth;
        } else {
            const authResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/api/lnurl/auth`,
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

    private setLightningAddress = async (handle: string, domain: string) => {
        await Storage.setItem(ADDRESS_ACTIVATED_STRING, true);
        runInAction(() => {
            this.lightningAddressActivated = true;
            this.lightningAddressHandle = handle;
            this.lightningAddressDomain = domain;
            this.lightningAddress = `${handle}@${domain}`;
        });
    };

    @action
    public createCashu = async (mint_url: string) => {
        this.error = false;
        this.error_msg = '';
        this.loading = true;

        try {
            const { verification, signature } = await this.getAuthData();

            if (!this.cashuStore.cashuWallets[mint_url]) {
                await this.cashuStore.initializeWallet(mint_url);
            }

            const createResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/api/lnurl/create`,
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
                this.updatePushCredentials().catch((e) =>
                    console.log('Failed to update push credentials', e)
                );
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
                `${LNURL_HOST}/api/lnurl/create`,
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
                this.updatePushCredentials().catch((e) =>
                    console.log('Failed to update push credentials', e)
                );
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
                `${LNURL_HOST}/api/lnurl/nwc/test`,
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
                `${LNURL_HOST}/api/lnurl/update`,
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

    @action
    public status = async (isRedeem?: boolean) => {
        this.loading = true;

        try {
            const { verification, signature } = await this.getAuthData();

            const statusResponse = await ReactNativeBlobUtil.fetch(
                'POST',
                `${LNURL_HOST}/api/lnurl/status`,
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
                paid,
                minimumSats,
                handle,
                domain,
                addressType,
                plusExpiresAt,
                plusAnnualFeeSats,
                plusDiscount,
                legacyAccount,
                perks,
                deviceToken,
                image,
                bio,
                noffer
            } = statusData;

            runInAction(() => {
                if (!isRedeem) {
                    this.error = false;
                    this.error_msg = '';
                }
                this.loading = false;
                // only Cashu payments can be redeemed in the app; held
                // payments to a retired Zaplocker address are dropped
                this.paid = addressType === 'cashu' ? paid || [] : [];
                this.minimumSats = minimumSats;
                this.lightningAddressHandle = handle;
                this.lightningAddressDomain = domain;
                this.lightningAddressType = addressType;
                this.zeusPlusExpiresAt = plusExpiresAt;
                this.zeusPlusAnnualFeeSats = plusAnnualFeeSats;
                this.zeusPlusDiscount = plusDiscount;
                this.legacyAccount = legacyAccount;
                this.perks = perks;
                this.image = image || null;
                this.bio = bio || null;
                this.noffer = noffer || null;
                this.serviceDeviceToken = deviceToken;
                if (handle && domain) {
                    this.lightningAddress = `${handle}@${domain}`;
                }
            });
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

    private callRedeemEndpoint = async (quote_id: string) => {
        const { verification, signature } = await this.getAuthData();

        const redeemResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${LNURL_HOST}/api/lnurl/nuts/redeem`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({
                pubkey: this.nodeInfoStore.nodeInfo.identity_pubkey,
                message: verification,
                signature,
                quoteId: quote_id
            })
        );

        const redeemData = redeemResponse.json();

        if (redeemResponse.info().status !== 200 || !redeemData.success) {
            throw redeemData.error;
        }

        return redeemData;
    };

    @action
    public deletePayment = async (quote_id: string) => {
        this.error = false;
        this.error_msg = '';
        this.redeeming = true;

        try {
            await this.callRedeemEndpoint(quote_id);
            runInAction(() => {
                this.redeeming = false;
            });
            this.status(true).catch((e) =>
                console.log('Error fetching Lightning address status', e)
            );
        } catch (error) {
            const error_msg = error?.toString();
            runInAction(() => {
                this.redeeming = false;
                this.error = true;
                this.error_msg = error_msg;
            });
        }
    };

    @action
    public redeemCashu = async (
        quote_id: string,
        mint_url: string,
        amount_msat: number,
        skipStatus?: boolean,
        localNotification?: boolean,
        skipMintCheck?: boolean
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

            const title = localeString('zeuspay.paymentReceived.title');
            const body = localeString('zeuspay.paymentReceived.body', {
                value: value_commas,
                unit:
                    value_commas === '1' ? 'sat' : localeString('general.sats')
            });
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
                true, // lockedQuote
                skipMintCheck
            );

            if (
                response?.isPaid ||
                response?.updatedInvoice?.state === 'ISSUED'
            ) {
                try {
                    const redeemData = await this.callRedeemEndpoint(quote_id);

                    // If server returns a token, receive it
                    if (redeemData.token) {
                        console.log(
                            'Receiving token from server for quote:',
                            quote_id
                        );
                        // Provide our Cashu secret key; CDK will only use it if the token is P2PK-locked.
                        const signingKey =
                            this.cashuStore.deriveCashuSecretKey();
                        await this.cashuStore.receiveTokenCDK(
                            redeemData.token,
                            signingKey || undefined
                        );
                    }

                    this.redeeming = false;

                    if (localNotification && response.isPaid) {
                        fireLocalNotification();
                    }

                    if (!skipStatus) {
                        this.status(true).catch((e) =>
                            console.log(
                                'Error fetching Lightning address status',
                                e
                            )
                        );
                    }

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
    public setDeviceToken = (token: string) => {
        this.currentDeviceToken = token;
        if (this.pendingPushUpdate) {
            this.pendingPushUpdate = false;
            this.updatePushCredentials().catch((e) =>
                console.log('Failed to update push credentials', e)
            );
        }
    };

    public updatePushCredentials = async () => {
        if (!this.currentDeviceToken) {
            // Device token hasn't arrived yet — defer until
            // setDeviceToken is called by the push notification callback
            this.pendingPushUpdate = true;
            return;
        }
        // only push update if the device token has changed
        if (
            !this.serviceDeviceToken ||
            this.currentDeviceToken !== this.serviceDeviceToken
        ) {
            await this.update({
                device_token: this.currentDeviceToken,
                device_platform: Platform.OS
            });
        }
    };

    @action
    public redeemAllOpenPaymentsCashu = async (localNotification?: boolean) => {
        this.redeemingAll = true;

        const openPaymentsToProcess = this.paid.slice().reverse();
        const totalPayments = openPaymentsToProcess.length;

        for (let i = 0; i < totalPayments; i++) {
            const item = openPaymentsToProcess[i];
            const isLast = i === totalPayments - 1; // True if this is the last item

            await this.redeemCashu(
                item.quote_id,
                item.mint_url,
                item.amount_msat,
                true, // skipStatus
                localNotification,
                !isLast // skipMintCheck
            );
        }

        runInAction(() => {
            this.status(true).catch((e) =>
                console.log('Error fetching Lightning address status', e)
            );
            this.redeemingAll = false;
        });
    };

    private subscribeUpdatesCashu = async () => {
        const { verification, signature } = await this.getAuthData();

        this.socket = io(LNURL_HOST, {
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

    public prepareToAutomaticallyAcceptCashu = () => {
        if (this.socket && this.socket.connected) return;
        this.redeemAllOpenPaymentsCashu(true).catch((e) =>
            console.log('Error redeeming payments', e)
        );
        this.subscribeUpdatesCashu().catch((e) =>
            console.log('Error subscribing to Lightning address updates', e)
        );
    };

    @action
    public reset = () => {
        this.loading = false;
        this.error = false;
        this.error_msg = '';
        this.paid = [];
        // the cached auth signature is tied to the previous node's
        // pubkey; reusing it after a node switch makes the server
        // reject calls with 'invalid signature'
        this.auth = undefined;
        this.authDate = undefined;
        if (this.socket) this.socket.disconnect();
        this.socket = undefined;
        this.lightningAddress = '';
        this.lightningAddressHandle = '';
        this.lightningAddressDomain = '';
        this.lightningAddressType = '';
        this.zeusPlusExpiresAt = undefined;
        this.zeusPlusAnnualFeeSats = undefined;
        this.zeusPlusDiscount = undefined;
        this.legacyAccount = false;
        this.perks = [];
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
                `${LNURL_HOST}/api/lnurl/delete`,
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
                `${LNURL_HOST}/api/plus/order`,
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
