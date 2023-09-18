import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';

import SettingsStore from './SettingsStore';
import stores from './Stores';

import lndMobile from '../lndmobile/LndMobileInjection';
const { channel } = lndMobile;

import Base64Utils from '../utils/Base64Utils';
import { LndMobileEventEmitter } from '../utils/LndMobileUtils';
import { localeString } from '../utils/LocaleUtils';

export default class LSPStore {
    @observable public info: any = {};
    @observable public zeroConfFee: number | undefined;
    @observable public error: boolean = false;
    @observable public error_msg: string = '';
    @observable public showLspSettings: boolean = false;
    @observable public channelAcceptor: any;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public reset = () => {
        this.info = {};
        this.zeroConfFee = undefined;
        this.error = false;
        this.error_msg = '';
        this.showLspSettings = false;
        this.channelAcceptor = undefined;
    };

    getLSPHost = () =>
        this.settingsStore.embeddedLndNetwork === 'Mainnet'
            ? this.settingsStore.settings.lspMainnet
            : this.settingsStore.settings.lspTestnet;

    @action
    public getLSPInfo = () => {
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'get',
                `${this.getLSPHost()}/api/v1/info`,
                {
                    'Content-Type': 'application/json'
                }
            )
                .then((response: any) => {
                    const status = response.info().status;
                    const data = response.json();
                    if (status == 200) {
                        this.info = data;
                        resolve(this.info);
                    } else {
                        this.error = true;
                        this.error_msg = data.message;
                        // handle LSP geoblocking :(
                        if (
                            this.error_msg.includes(
                                'unavailable in your country'
                            )
                        ) {
                            this.showLspSettings = true;
                        }
                        reject();
                    }
                })
                .catch(() => {
                    this.error = true;
                    this.error_msg = localeString(
                        'stores.LSPStore.connectionError'
                    );
                    this.showLspSettings = true;
                    reject();
                });
        });
    };

    @action
    public getZeroConfFee = (amount_msat: number) => {
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'post',
                `${this.getLSPHost()}/api/v1/fee`,
                {
                    'Content-Type': 'application/json'
                },
                JSON.stringify({
                    amount_msat,
                    pubkey: stores.nodeInfoStore.nodeInfo.nodeId
                })
            )
                .then((response: any) => {
                    const status = response.info().status;
                    const data = response.json();
                    if (status == 200) {
                        this.zeroConfFee = Number.parseInt(
                            (Number(data.fee_amount_msat) / 1000).toString()
                        );
                        resolve(this.zeroConfFee);
                    } else {
                        this.error = true;
                        reject();
                    }
                })
                .catch(() => {
                    this.error = true;
                    reject();
                });
        });
    };

    handleChannelAcceptorEvent = async (channelAcceptRequest: any) => {
        try {
            const requestPubkey = Base64Utils.bytesToHexString(
                channelAcceptRequest.node_pubkey
            );

            // Only allow 0-conf chans from LSP or whitelisted peers
            const isZeroConfAllowed =
                this.info?.pubkey === requestPubkey ||
                (this.settingsStore?.settings?.zeroConfPeers &&
                    this.settingsStore?.settings?.zeroConfPeers.includes(
                        requestPubkey
                    ));

            await channel.channelAcceptorResponse(
                channelAcceptRequest.pending_chan_id,
                !channelAcceptRequest.wants_zero_conf || isZeroConfAllowed,
                isZeroConfAllowed
            );
        } catch (error: any) {
            console.error('handleChannelAcceptorEvent error:', error.message);
        }
    };

    @action
    public initChannelAcceptor = async () => {
        if (this.channelAcceptor) return;
        this.channelAcceptor = LndMobileEventEmitter.addListener(
            'ChannelAcceptor',
            async (event: any) => {
                try {
                    const channelAcceptRequest =
                        channel.decodeChannelAcceptRequest(event.data);

                    await this.handleChannelAcceptorEvent(channelAcceptRequest);
                } catch (error: any) {
                    console.error('channel acceptance error: ' + error.message);
                }
            }
        );

        await channel.channelAcceptor();
    };

    @action
    public getZeroConfInvoice = (bolt11: string) => {
        this.error = false;
        this.error_msg = '';
        this.showLspSettings = false;
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'post',
                `${this.getLSPHost()}/api/v1/proposal`,
                this.settingsStore.settings.lspAccessKey
                    ? {
                          'Content-Type': 'application/json',
                          'x-auth-token':
                              this.settingsStore.settings.lspAccessKey
                      }
                    : {
                          'Content-Type': 'application/json'
                      },
                JSON.stringify({
                    bolt11,
                    // TODO investigate why Taproot chans from LSP
                    // result in unsettled funds
                    simpleTaproot: false
                })
            )
                .then(async (response: any) => {
                    const status = response.info().status;
                    const data = response.json();
                    if (status == 200 || status == 201) {
                        resolve(data.jit_bolt11);
                    } else {
                        this.error = true;
                        this.error_msg = `${localeString(
                            'stores.LSPStore.error'
                        )}: ${data.message}`;
                        if (
                            data.message &&
                            data.message.includes('access key')
                        ) {
                            this.showLspSettings = true;
                        }
                        reject();
                    }
                })
                .catch(() => {
                    this.error = true;
                    reject();
                });
        });
    };
}
