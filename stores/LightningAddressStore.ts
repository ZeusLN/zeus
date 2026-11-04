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
    @observable public noffer: string | null = null;
    @observable public zeusPlusExpiresAt: any;
    @observable public zeusPlusAnnualFeeSats: any;
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

            // Preimages from a former Zaplocker address have no use
            // after switching to another address type
            if (updates?.address_type) {
                await Storage.setItem(HASHES_STORAGE_STRING, '').catch(
                    (e: any) => console.log('Error clearing local hashes', e)
                );
            }

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

    // Normalize a mint URL for equality comparison: strip surrounding
    // whitespace and any trailing slash, and lower-case the scheme and
    // host, which are the only case-insensitive parts of a URL (RFC 3986).
    // The path is kept byte-exact: two mints on one host may differ only
    // by path case. Matched with a regex rather than the URL polyfill,
    // which does not case-fold hosts. Kept local so the security check
    // below does not depend on another store's private helper. The URL
    // comes from the server, so anything that is not a string normalizes
    // to '' and takes the normal "not approved" path instead of throwing.
    private normalizeMintUrl = (url?: unknown): string => {
        if (typeof url !== 'string' || !url) return '';
        return url
            .trim()
            .replace(/\/+$/, '')
            .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, (schemeAndHost) =>
                schemeAndHost.toLowerCase()
            );
    };

    // Automatic paths (socket events, redeem-all on startup) drop an
    // untrusted-mint payment silently, but a user tapping Redeem needs to
    // see why nothing happened.
    private rejectUntrustedMint = (localNotification?: boolean) => {
        if (localNotification) return;
        runInAction(() => {
            this.error = true;
            this.error_msg = localeString(
                'stores.LightningAddressStore.Cashu.mintMismatch'
            );
        });
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

        // Security: the ZEUS Pay socket is a hint channel, not a command
        // channel. A `paid` event (and the server-supplied open-payments
        // list) names the mint URL to redeem from, but the wallet must only
        // ever mint from a mint the user has approved: the mint this
        // lightning address was created with (settings.lightningAddress.
        // mintUrl, set in createCashu) or a mint the user approved in the
        // wallet (cashuStore.mintUrls: Add Mint, onboarding, Nostr restore;
        // mints CDK added on demand are kept out of it). These keep quotes
        // redeemable when the configured mint changes or is overwritten by
        // an unrelated lightningAddress settings write. Binding here, at
        // the single chokepoint every caller passes through, stops a
        // malicious or compromised backend from steering the wallet to an
        // arbitrary mint (fake-deposit injection, unapproved mint trust,
        // raw-HTTP fetch of an attacker URL). On a match, the locally
        // stored URL is forwarded downstream instead of the server-supplied
        // spelling, so the server cannot influence how the mint is keyed in
        // CDK either.
        const configuredMintUrl =
            this.settingsStore?.settings?.lightningAddress?.mintUrl;
        const trustedMintUrls: string[] = configuredMintUrl
            ? [configuredMintUrl, ...(this.cashuStore?.mintUrls || [])]
            : this.cashuStore?.mintUrls || [];
        const normalizedEventMintUrl = this.normalizeMintUrl(mint_url);
        const trustedMintUrl = normalizedEventMintUrl
            ? trustedMintUrls.find(
                  (url) => this.normalizeMintUrl(url) === normalizedEventMintUrl
              )
            : undefined;
        if (!trustedMintUrl) {
            console.warn(
                'LightningAddressStore.redeemCashu: refusing to redeem against a mint that is neither the configured lightning address mint nor a locally added mint'
            );
            // This call has not set `redeeming`, so leave it alone: a
            // forged event must not clear the flag of a redeem in progress.
            this.rejectUntrustedMint(localNotification);
            return false;
        }

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
                trustedMintUrl,
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
                        // Security: CDK's receive adds whatever mint the
                        // token names, so bind the server's token to the
                        // approved mint too. Without this a compromised
                        // backend could reference an already issued quote
                        // at the approved mint and return a token from any
                        // mint. A token that fails to decode throws and is
                        // not received.
                        const decoded = await this.cashuStore.decodeTokenCDK(
                            redeemData.token
                        );
                        if (
                            this.normalizeMintUrl(decoded?.mint_url) !==
                            this.normalizeMintUrl(trustedMintUrl)
                        ) {
                            console.warn(
                                'LightningAddressStore.redeemCashu: refusing a redeem token from a mint other than the approved mint'
                            );
                            runInAction(() => {
                                this.redeeming = false;
                            });
                            this.rejectUntrustedMint(localNotification);
                            return false;
                        }
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
        // Each redeemCashu call clears the error first, so a mint rejection
        // would be wiped by the next payment. redeemCashu only returns
        // false on a mint rejection; surface it once the loop is done.
        let rejected = false;

        try {
            const openPaymentsToProcess = this.paid.slice().reverse();
            const totalPayments = openPaymentsToProcess.length;

            for (let i = 0; i < totalPayments; i++) {
                const item = openPaymentsToProcess[i];
                const isLast = i === totalPayments - 1; // True if this is the last item

                // The list is server-supplied: one bad item must not stop the
                // remaining payments from being redeemed.
                try {
                    const redeemed = await this.redeemCashu(
                        item.quote_id,
                        item.mint_url,
                        item.amount_msat,
                        true, // skipStatus
                        localNotification,
                        !isLast // skipMintCheck
                    );
                    if (redeemed === false) rejected = true;
                } catch (e) {
                    console.log('Error redeeming open payment', e);
                }
            }
        } finally {
            if (rejected) this.rejectUntrustedMint(localNotification);
            runInAction(() => {
                this.status(true).catch((e) =>
                    console.log('Error fetching Lightning address status', e)
                );
                this.redeemingAll = false;
            });
        }
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
            this.redeemCashu(
                quote_id,
                mint_url,
                amount_msat,
                false,
                true
            ).catch((e) =>
                console.log('Error redeeming Lightning address payment', e)
            );
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
