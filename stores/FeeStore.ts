import { action, observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';

import SettingsStore from './SettingsStore';
import NodeInfoStore from './NodeInfoStore';

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { errorToUserFriendly } from '../utils/ErrorUtils';
import ForwardEvent from '../models/ForwardEvent';

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
    @observable public tempFee: string = '';

    @observable public dayEarned: string | number;
    @observable public weekEarned: string | number;
    @observable public monthEarned: string | number;
    @observable public totalEarned: string | number;

    @observable public forwardingEvents: Array<ForwardEvent> = [];
    @observable public lastOffsetIndex: number;
    @observable public forwardingHistoryError = false;

    @observable public bumpFeeSuccess = false;
    @observable public bumpFeeError = false;
    @observable public bumpFeeErrorMsg = '';

    getOnchainFeesToken: any;

    settingsStore: SettingsStore;
    nodeInfoStore: NodeInfoStore;

    constructor(settingsStore: SettingsStore, nodeInfoStore: NodeInfoStore) {
        this.settingsStore = settingsStore;
        this.nodeInfoStore = nodeInfoStore;
    }

    @action
    public getOnchainFeesviaMempool = () => {
        this.loading = true;
        this.error = false;
        this.recommendedFees = {};
        return ReactNativeBlobUtil.fetch(
            'get',
            `https://mempool.space/${
                this.nodeInfoStore.nodeInfo.isTestNet ? 'testnet/' : ''
            }api/v1/fees/recommended`
        )
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    runInAction(() => {
                        this.loading = false;
                        this.recommendedFees = response.json();
                    });
                    return this.recommendedFees;
                } else {
                    runInAction(() => {
                        this.recommendedFees = {};
                        this.loading = false;
                        this.error = true;
                    });
                }
            })
            .catch((error: any) => {
                console.error('Error fetching fees:', error);
                runInAction(() => {
                    this.recommendedFees = {};
                    this.loading = false;
                    this.error = true;
                });
            });
    };

    @action
    public resetFees = () => {
        this.fees = {};
        this.loadingFees = false;
        this.bumpFeeSuccess = false;
        this.resetErrors();
    };

    resetErrors = () => {
        this.bumpFeeError = false;
        this.bumpFeeErrorMsg = '';
    };

    @action
    public getFees = () => {
        this.loadingFees = true;
        BackendUtils.getFees()
            .then((data: any) => {
                runInAction(() => {
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
                    // Used in Core Lightning
                    this.totalEarned = data.total_fee_sum || 0;
                    this.loadingFees = false;
                });
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
        baseFeeInbound: string,
        feeRateInbound: string,
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
            base_fee_msat_inbound: `${Number(baseFeeInbound) * 1000}`,
            fee_rate_inbound: feeRateInbound,
            time_lock_delta: timeLockDelta
        };

        if (channelId) {
            // Core Lightning
            data.channelId = channelId;
        }
        if (channelPoint) {
            // lnd
            const [funding_txid, output_index] = channelPoint.split(':');
            data.chan_point = {
                output_index: Number(output_index),
                funding_txid_str: funding_txid,
                funding_txid_bytes: Base64Utils.utf8ToBase64(funding_txid) // must encode in base64
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
                runInAction(() => {
                    this.loading = false;
                    this.setFeesSuccess = true;
                });
            })
            .catch((err: any) => {
                runInAction(() => {
                    this.setFeesErrorMsg = errorToUserFriendly(err);
                    this.loading = false;
                    this.setFeesError = true;
                });
            });
    };

    @action setTempFee = (fee: string) => {
        this.tempFee = fee;
    };

    @action
    private forwardingError = () => {
        this.forwardingEvents = [];
        this.forwardingHistoryError = true;
        this.loading = false;
    };

    @action
    public getForwardingHistory = (params?: number) => {
        if (this.loading) return;
        this.loading = true;
        this.forwardingEvents = [];
        this.forwardingHistoryError = false;
        this.earnedDuringTimeframe = new BigNumber(0);

        const response =
            params != null
                ? BackendUtils.isLNDBased()
                    ? BackendUtils.getForwardingHistory(params)
                    : BackendUtils.getForwardingHistory()
                : BackendUtils.getForwardingHistory();

        response
            .then((data: any) => {
                try {
                    runInAction(() => {
                        let rawEvents =
                            data.forwarding_events || data.forwards || [];

                        if (!BackendUtils.isLNDBased() && params != null) {
                            const cutoffTime =
                                Date.now() / 1000 - params * 3600;
                            rawEvents = rawEvents.filter(
                                (event: any) =>
                                    event.resolved_time >= cutoffTime
                            );
                        }

                        this.forwardingEvents = rawEvents
                            .map((event: any) => new ForwardEvent(event))
                            .reverse();

                        this.forwardingEvents.forEach((event: ForwardEvent) => {
                            this.earnedDuringTimeframe =
                                this.earnedDuringTimeframe.plus(
                                    Number(event.fee_msat) / 1000
                                );
                        });

                        this.lastOffsetIndex = data.last_offset_index;
                        this.loading = false;
                    });
                } catch (e: any) {
                    this.forwardingError();
                }
            })
            .catch((e: any) => {
                console.error('Fetching forwarding history failed:', e);
                this.forwardingError();
            });
    };

    @action
    public bumpForceCloseFee = (params?: any) => {
        this.loading = true;
        this.bumpFeeSuccess = false;
        this.bumpFeeError = false;
        const [funding_txid_str, output_index] = params.chan_point.split(':');
        BackendUtils.bumpForceCloseFee({
            ...params,
            chan_point: {
                funding_txid_str,
                output_index: Number(output_index) || 0
            }
        })
            .then(() => {
                this.bumpFeeSuccess = true;
                this.loading = false;
            })
            .catch((err: Error) => {
                this.bumpFeeError = true;
                this.bumpFeeErrorMsg = errorToUserFriendly(err);
                this.loading = false;
            });
    };

    @action
    public bumpFeeOpeningChannel = (params?: any) => {
        this.loading = true;
        this.bumpFeeSuccess = false;
        this.bumpFeeError = false;
        const [txid_str, output_index] = params.outpoint.split(':');
        BackendUtils.bumpFee({
            ...params,
            outpoint: {
                txid_str,
                output_index: Number(output_index) || 0
            }
        })
            .then(() => {
                runInAction(() => {
                    this.bumpFeeSuccess = true;
                    this.loading = false;
                });
            })
            .catch((err: Error) => {
                // if output isn't correct (it'll be index 0 or 1), try alternate input
                // NOTE: this will only work for single-party funded channels
                if (
                    err
                        .toString()
                        .includes(
                            'the passed output does not belong to the wallet'
                        )
                ) {
                    const newOutputIndex = output_index === '0' ? 1 : 0;
                    this.bumpFeeErrorMsg = `${err}. Retrying with input ${newOutputIndex}`;
                    BackendUtils.bumpFee({
                        ...params,
                        outpoint: {
                            txid_str,
                            output_index: newOutputIndex
                        }
                    })
                        .then(() => {
                            runInAction(() => {
                                this.bumpFeeError = false;
                                this.bumpFeeSuccess = true;
                                this.loading = false;
                            });
                        })
                        .catch((err: Error) => {
                            runInAction(() => {
                                this.bumpFeeError = true;
                                this.bumpFeeErrorMsg = errorToUserFriendly(err);
                                this.loading = false;
                            });
                        });
                } else {
                    runInAction(() => {
                        this.bumpFeeError = true;
                        this.bumpFeeErrorMsg = errorToUserFriendly(err);
                        this.loading = false;
                    });
                }
            });
    };
}
