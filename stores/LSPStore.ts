import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { NativeEventEmitter, NativeModules } from 'react-native';

import SettingsStore from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import stores from './Stores';

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

    constructor(settingsStore: SettingsStore, channelsStore: ChannelsStore) {
        this.settingsStore = settingsStore;
        this.channelsStore = channelsStore;
    }

    @action
    public reset = () => {
        this.info = {};
        this.resetFee();
        this.error = false;
        this.error_msg = '';
        this.showLspSettings = false;
        // TODO Pegasus clear channel acceptor when
        // it's supported by other backends
        // this.channelAcceptor = undefined;
    };

    @action
    public resetFee = () => {
        this.zeroConfFee = undefined;
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
        const { implementation } = this.settingsStore;
        if (this.channelAcceptor) return;

        if (implementation === 'embedded-lnd') {
            this.channelAcceptor = LndMobileEventEmitter.addListener(
                'ChannelAcceptor',
                async (event: any) => {
                    try {
                        const result = channel.decodeChannelAcceptRequest(
                            event.data
                        );
                        await this.handleChannelAcceptorEvent(result);
                    } catch (error: any) {
                        console.error(
                            'channelAcceptorEvent embedded-lnd error:',
                            error.message
                        );
                    }
                }
            );

            await channel.channelAcceptor();
        }

        // if (implementation === 'lightning-node-connect') {
        //     const { LncModule } = NativeModules;
        //     const eventEmitter = new NativeEventEmitter(LncModule);
        //     console.log('hERE', eventEmitter);
        //     const call = BackendUtils.channelAcceptor();
        //     console.log('call', call)
        //     this.channelAcceptor = eventEmitter.addListener(
        //         'lnrpc.Lightning.ChannelAcceptor',
        //         (event: any) => {
        //             // console.log('-->', event);
        //             if (event.result) {
        //                 try {
        //                     const result = JSON.parse(event.result);
        //                     console.log('~~RESULT', result);
        //                     // only allow zero conf chans from the LSP
        //                     const isZeroConfAllowed =
        //                         result.node_pubkey === this.info.pub_key;

        //                     BackendUtils.channelAcceptorAnswer({
        //                         pending_chan_id: result.pending_chan_id,
        //                         zero_conf:
        //                             !result.wants_zero_conf ||
        //                             isZeroConfAllowed,
        //                         accept: isZeroConfAllowed
        //                     });
        //                 } catch (error: any) {
        //                     console.error(
        //                         'channelAcceptorEvent lightning-node-connect error:',
        //                         error.message
        //                     );
        //                 }
        //             }
        //         }
        //     );

        //     console.log('~~~this.channelAcceptor', this.channelAcceptor);
        // }
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
