import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';

import SettingsStore from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import NodeInfoStore from './NodeInfoStore';

import lndMobile from '../lndmobile/LndMobileInjection';
const { channel } = lndMobile;

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { LndMobileEventEmitter } from '../utils/LndMobileUtils';
import { localeString } from '../utils/LocaleUtils';

export default class LSPStore {
    @observable public info: any = {};
    @observable public zeroConfFee: number | undefined;
    @observable public feeId: string | undefined;
    @observable public error: boolean = false;
    @observable public error_msg: string = '';
    @observable public showLspSettings: boolean = false;
    @observable public channelAcceptor: any;

    settingsStore: SettingsStore;
    channelsStore: ChannelsStore;
    nodeInfoStore: NodeInfoStore;

    constructor(
        settingsStore: SettingsStore,
        channelsStore: ChannelsStore,
        nodeInfoStore: NodeInfoStore
    ) {
        this.settingsStore = settingsStore;
        this.channelsStore = channelsStore;
        this.nodeInfoStore = nodeInfoStore;
    }

    @action
    public reset = () => {
        this.info = {};
        this.resetFee();
        this.error = false;
        this.error_msg = '';
        this.showLspSettings = false;
        this.channelAcceptor = undefined;
    };

    @action
    public resetFee = () => {
        this.zeroConfFee = undefined;
    };

    getLSPHost = () =>
        this.nodeInfoStore!.nodeInfo.isTestNet
            ? this.settingsStore.settings.lspTestnet
            : this.settingsStore.settings.lspMainnet;

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
                .then(async (response: any) => {
                    const status = response.info().status;
                    const data = response.json();
                    if (status == 200) {
                        this.info = data;
                        resolve(this.info);

                        const method =
                            this.info.connection_methods &&
                            this.info.connection_methods[0];

                        try {
                            await this.channelsStore.connectPeer(
                                {
                                    host: `${method.address}:${method.port}`,
                                    node_pubkey_string: this.info.pubkey,
                                    local_funding_amount: ''
                                },
                                false,
                                true,
                                true
                            );
                        } catch (e) {}
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
        const { settings } = this.settingsStore;

        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'post',
                `${this.getLSPHost()}/api/v1/fee`,
                settings.lspAccessKey
                    ? {
                          'Content-Type': 'application/json',
                          'x-auth-token': settings.lspAccessKey
                      }
                    : {
                          'Content-Type': 'application/json'
                      },
                JSON.stringify({
                    amount_msat,
                    pubkey: this.nodeInfoStore.nodeInfo.nodeId
                })
            )
                .then((response: any) => {
                    const status = response.info().status;
                    const data = response.json();
                    if (status == 200) {
                        this.zeroConfFee = data.fee_amount_msat
                            ? Number.parseInt(
                                  (
                                      Number(data.fee_amount_msat) / 1000
                                  ).toString()
                              )
                            : undefined;
                        this.feeId = data.id;
                        this.error = false;
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
            const requestPubkey = Base64Utils.bytesToHex(
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
        if (this.settingsStore.implementation === 'embedded-lnd') {
            this.channelAcceptor = LndMobileEventEmitter.addListener(
                'ChannelAcceptor',
                async (event: any) => {
                    try {
                        const channelAcceptRequest =
                            channel.decodeChannelAcceptRequest(event.data);

                        await this.handleChannelAcceptorEvent(
                            channelAcceptRequest
                        );
                    } catch (error: any) {
                        console.error(
                            'channel acceptance error: ' + error.message
                        );
                    }
                }
            );

            await channel.channelAcceptor();
        } else {
            // Only allow 0-conf chans from LSP or whitelisted peers

            BackendUtils.initChanAcceptor({
                zeroConfPeers: this.settingsStore?.settings?.zeroConfPeers,
                lspPubkey: this.info?.pubkey
            });
        }
    };

    @action
    public getZeroConfInvoice = (bolt11: string) => {
        this.error = false;
        this.error_msg = '';
        this.showLspSettings = false;

        const { settings } = this.settingsStore;

        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'post',
                `${this.getLSPHost()}/api/v1/proposal`,
                settings.lspAccessKey
                    ? {
                          'Content-Type': 'application/json',
                          'x-auth-token': settings.lspAccessKey
                      }
                    : {
                          'Content-Type': 'application/json'
                      },
                JSON.stringify({
                    bolt11,
                    fee_id: this.feeId,
                    simpleTaproot: settings.requestSimpleTaproot
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
