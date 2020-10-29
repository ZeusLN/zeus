import { action, observable } from 'mobx';
import RNFetchBlob from 'rn-fetch-blob';
import RESTUtils from './../utils/RESTUtils';
import Base64Utils from './../utils/Base64Utils';
import ForwardEvent from './../models/ForwardEvent';
import SettingsStore from './SettingsStore';

export default class FeeStore {
    @observable public fees: any = {};
    @observable public channelFees: any = {};
    @observable public dataFrame: any = {};
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public setFeesError: boolean = false;
    @observable public setFeesSuccess: boolean = false;

    @observable public dayEarned: string | number;
    @observable public weekEarned: string | number;
    @observable public monthEarned: string | number;
    @observable public totalEarned: string | number;

    @observable public forwardingEvents: Array<any> = [];
    @observable public lastOffsetIndex: number;
    @observable public forwardingHistoryError: boolean = false;

    getOnchainFeesToken: any;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public getOnchainFees = () => {
        this.loading = true;
        RNFetchBlob.fetch('get', 'https://whatthefee.io/data.json')
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.json();
                    this.loading = false;
                    this.dataFrame = data;
                } else {
                    this.dataFrame = {};
                    this.loading = false;
                }
            })
            .catch(() => {
                this.dataFrame = {};
                this.loading = false;
            });
    };

    resetFees = () => {
        this.fees = {};
        this.loading = false;
    };

    feesError = () => {
        this.loading = false;
        this.setFeesError = true;
    };

    @action
    public getFees = () => {
        this.loading = true;
        RESTUtils.getFees()
            .then((data: any) => {
                const channelFees: any = {};
                data.channel_fees.forEach((channelFee: any) => {
                    channelFees[channelFee.chan_point] = channelFee;
                });

                this.channelFees = channelFees;
                this.dayEarned = data.day_fee_sum || 0;
                this.weekEarned = data.week_fee_sum || 0;
                this.monthEarned = data.month_fee_sum || 0;
                // this.totalEarned = data.total_fee_sum || 0; DEPRECATED

                this.loading = false;
            })
            .catch((err: any) => {
                console.log('error getting fee report', err);
                this.resetFees();
            });
    };

    @action
    public setFees = (
        newBaseFeeMsat: string,
        newFeeRateMiliMsat: any,
        channelPoint?: string,
        channelId?: string
    ) => {
        this.loading = true;
        this.setFeesError = false;
        this.setFeesSuccess = false;

        const data: any = {
            base_fee_msat: newBaseFeeMsat,
            fee_rate: newFeeRateMiliMsat / 1000000,
            time_lock_delta: 4
        };

        if (channelId) {
            // c-lightning, eclair
            data.channelId = channelId;
        } else if (channelPoint) {
            // lnd
            const [funding_txid, output_index] = channelPoint.split(':');
            data.chan_point = {
                output_index: Number(output_index),
                funding_txid_str: funding_txid,
                funding_txid_bytes: Base64Utils.btoa(funding_txid) // must encode in base64
            };
        } else {
            data.global = true;
        }

        RESTUtils.setFees(data)
            .then(() => {
                this.loading = false;
                this.setFeesSuccess = true;
            })
            .catch(() => {
                this.feesError();
            });
    };

    forwardingError = () => {
        this.loading = false;
        this.forwardingHistoryError = true;
    };

    @action
    public getForwardingHistory = (params?: any) => {
        this.loading = true;
        RESTUtils.getForwardingHistory(params)
            .then((data: any) => {
                this.forwardingEvents = data.forwarding_events
                    .map((event: any) => new ForwardEvent(event))
                    .reverse();
                this.lastOffsetIndex = data.last_offset_index;
                this.loading = false;
            })
            .catch(() => {
                this.forwardingError();
            });
    };
}
