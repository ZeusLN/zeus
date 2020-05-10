import { action, observable } from 'mobx';
import axios from 'axios';
import RESTUtils from './../utils/RESTUtils';
import Base64Utils from './../utils/Base64Utils';
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

    getOnchainFeesToken: any;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.getOnchainFeesToken = axios.CancelToken.source().token;
        this.settingsStore = settingsStore;
    }

    @action
    public getOnchainFees = () => {
        this.loading = true;
        axios
            .request({
                method: 'get',
                url: 'https://whatthefee.io/data.json',
                // url: `https://whatthefee.io/data.json?c=1555717500`,
                cancelToken: this.getOnchainFeesToken
            })
            .then((response: any) => {
                // handle success
                this.loading = false;
                const data = response.data;
                this.dataFrame = data;
            })
            .catch(() => {
                // handle error
                this.dataFrame = {};
                this.loading = false;
            });
    };

    @action
    public getFees = () => {
        this.loading = true;
        RESTUtils.getFees(this.settingsStore)
            .then((response: any) => {
                // handle success
                const data = response.data;

                // lnd
                if (data.channel_fees) {
                    const channelFees: any = {};
                    data.channel_fees.forEach((channelFee: any) => {
                        channelFees[channelFee.chan_point] = channelFee;
                    });

                    this.channelFees = channelFees;

                    this.dayEarned = data.day_fee_sum || 0;
                    this.weekEarned = data.week_fee_sum || 0;
                    this.monthEarned = data.month_fee_sum || 0;
                } else {
                    // c-lightning-REST
                    this.totalEarned = data.feeCollected / 1000; // msatoshi_fees_collected
                }

                this.loading = false;
            })
            .catch(() => {
                // handle error
                this.fees = {};
                this.loading = false;
            });
    };

    @action
    public setFees = (
        newBaseFeeMsat: string,
        newFeeRateMiliMsat: any,
        channelPoint?: string,
        channelId?: string
    ) => {
        const { implementation } = this.settingsStore;

        this.loading = true;
        this.setFeesError = false;
        this.setFeesSuccess = false;

        let data;
        if (implementation === 'c-lightning-REST') {
            if (channelId) {
                data = {
                    id: channelId,
                    base: newBaseFeeMsat,
                    ppm: Number(newFeeRateMiliMsat) / 1000000
                };
            } else {
                data = {
                    id: 'all',
                    base: newBaseFeeMsat,
                    ppm: Number(newFeeRateMiliMsat) / 1000000
                };
            }
        } else {
            // lnd
            if (channelPoint) {
                const [funding_txid, output_index] = channelPoint.split(':');
                data = {
                    base_fee_msat: newBaseFeeMsat,
                    fee_rate: newFeeRateMiliMsat / 1000000,
                    time_lock_delta: 4,
                    chan_point: {
                        output_index: Number(output_index),
                        funding_txid_str: funding_txid,
                        funding_txid_bytes: Base64Utils.btoa(funding_txid) // must encode in base64
                    }
                };
            } else {
                data = {
                    base_fee_msat: newBaseFeeMsat,
                    fee_rate: newFeeRateMiliMsat / 1000000,
                    time_lock_delta: 4,
                    global: true
                };
            }
        }

        RESTUtils.setFees(this.settingsStore, data)
            .then(() => {
                // handle success
                this.loading = false;
                this.setFeesSuccess = true;
            })
            .catch(() => {
                // handle error
                this.loading = false;
                this.setFeesError = true;
            });
    };
}
