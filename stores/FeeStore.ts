import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';

import BackendUtils from './../utils/BackendUtils';
import Base64Utils from './../utils/Base64Utils';
import ForwardEvent from './../models/ForwardEvent';
import SettingsStore from './SettingsStore';

export default class FeeStore {
    @observable public fees: any = {};
    @observable public earnedDuringTimeframe = new BigNumber(0);
    @observable public channelFees: any = {};
    @observable public dataFrame: any = {};
    @observable public recommendedFees: any = {};
    @observable public loading = false;
    @observable public loadingFees = false;
    @observable public error = false;
    @observable public setFeesError = false;
    @observable public setFeesErrorMsg: string;
    @observable public setFeesSuccess = false;

    @observable public dayEarned: string | number;
    @observable public weekEarned: string | number;
    @observable public monthEarned: string | number;
    @observable public totalEarned: string | number;

    @observable public forwardingEvents: Array<any> = [];
    @observable public lastOffsetIndex: number;
    @observable public forwardingHistoryError = false;

    getOnchainFeesToken: any;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public getOnchainFeesviaMempool = () => {
        this.loading = true;
        this.error = false;
        this.recommendedFees = {};
        ReactNativeBlobUtil.fetch(
            'get',
            'https://mempool.space/api/v1/fees/recommended'
        )
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    this.loading = false;
                    this.recommendedFees = response.json();
                } else {
                    this.recommendedFees = {};
                    this.loading = false;
                    this.error = true;
                }
            })
            .catch(() => {
                this.recommendedFees = {};
                this.loading = false;
            });
    };

    resetFees = () => {
        this.fees = {};
        this.loadingFees = false;
    };

    @action
    public getFees = () => {
        this.loadingFees = true;
        BackendUtils.getFees()
            .then((data: any) => {
                if (data.channel_fees) {
                    const channelFees: any = {};
                    data.channel_fees.forEach((channelFee: any) => {
                        channelFees[channelFee.chan_point] = channelFee;
                    });

                    this.channelFees = channelFees;
                }

                this.dayEarned = data.day_fee_sum || 0;
                this.weekEarned = data.week_fee_sum || 0;
                this.monthEarned = data.month_fee_sum || 0;
                // Deprecated in LND
                // Used in c-lightning-REST
                this.totalEarned = data.total_fee_sum || 0;
                this.loadingFees = false;
            })
            .catch((err: any) => {
                console.log('error getting fee report', err);
                this.resetFees();
            });
    };

    @action
    public setFees = (
        newBaseFee: string,
        newFeeRate: string,
        timeLockDelta = 4,
        channelPoint?: string,
        channelId?: string,
        minHtlc?: string,
        maxHtlc?: string
    ) => {
        this.loading = true;
        this.setFeesError = false;
        this.setFeesErrorMsg = '';
        this.setFeesSuccess = false;

        // handle commas in place of decimals
        const baseFee = newBaseFee.replace(/,/g, '.');
        const feeRate = newFeeRate.replace(/,/g, '.');

        const data: any = {
            base_fee_msat: `${Number(baseFee) * 1000}`,
            fee_rate: feeRate,
            time_lock_delta: timeLockDelta
        };

        if (channelId) {
            // c-lightning, eclair
            data.channelId = channelId;
        }
        if (channelPoint) {
            // lnd
            const [funding_txid, output_index] = channelPoint.split(':');
            data.chan_point = {
                output_index: Number(output_index),
                funding_txid_str: funding_txid,
                funding_txid_bytes: Base64Utils.btoa(funding_txid) // must encode in base64
            };
        }

        if (!channelId && !channelPoint) {
            data.global = true;
        }

        if (minHtlc) {
            data.min_htlc = minHtlc;
        }
        if (maxHtlc) {
            data.max_htlc = maxHtlc;
        }

        return BackendUtils.setFees(data)
            .then(() => {
                this.loading = false;
                this.setFeesSuccess = true;
            })
            .catch((err: any) => {
                this.setFeesErrorMsg = err.toString();
                this.loading = false;
                this.setFeesError = true;
            });
    };

    forwardingError = () => {
        this.forwardingEvents = [];
        this.forwardingHistoryError = true;
        this.loading = false;
    };

    @action
    public getForwardingHistory = (params?: any) => {
        if (this.loading) return;
        this.loading = true;
        this.forwardingEvents = [];
        this.forwardingHistoryError = false;
        this.earnedDuringTimeframe = new BigNumber(0);
        BackendUtils.getForwardingHistory(params)
            .then((data: any) => {
                this.forwardingEvents = data.forwarding_events
                    .map((event: any) => new ForwardEvent(event))
                    .reverse();

                // Add up fees earned for this timeframe
                // Uses BigNumber to prevent rounding errors in the add operation
                this.forwardingEvents.map(
                    (event: ForwardEvent) =>
                        (this.earnedDuringTimeframe =
                            this.earnedDuringTimeframe.plus(
                                Number(event.fee_msat) / 1000
                            ))
                );

                this.lastOffsetIndex = data.last_offset_index;
                this.loading = false;
            })
            .catch(() => {
                this.forwardingError();
            });
    };
}
