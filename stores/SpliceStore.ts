import { action, observable, runInAction } from 'mobx';
import BackendUtils from '../utils/BackendUtils';
import {
    SpliceOutRequest,
    SpliceInRequest,
    SpliceDryrunResult,
    SpliceExecutionResult
} from '../models/SpliceRequest';
import {
    SpliceOperation,
    SpliceOperationType,
    SpliceStatus
} from '../models/SpliceOperation';
import TransactionsStore from './TransactionsStore';
import ChannelsStore from './ChannelsStore';

const SPLICE_CLEANUP_INTERVAL = 5000;

export default class SpliceStore {
    @observable public activeSplices: Map<string, SpliceOperation> = new Map();
    @observable public loading = false;
    @observable public error: string | null = null;
    @observable public currentDryrunResult: SpliceDryrunResult | null = null;

    private transactionsStore: TransactionsStore;
    private channelsStore: ChannelsStore;

    constructor(
        transactionsStore: TransactionsStore,
        channelsStore: ChannelsStore
    ) {
        this.transactionsStore = transactionsStore;
        this.channelsStore = channelsStore;
    }

    @action
    public initiateSpliceOut = async (
        request: SpliceOutRequest
    ): Promise<SpliceDryrunResult | null> => {
        const channelStateCheck = this.validateChannelState(request.channelId);
        if (!channelStateCheck.isValid) {
            runInAction(() => {
                this.error = channelStateCheck.error;
                this.loading = false;
            });
            return null;
        }

        if (BackendUtils.supportsSpliceDryrun()) {
            return this.performDryrun(request, SpliceOperationType.OUT);
        }

        const minimalResult: SpliceDryrunResult = {
            txid: '',
            fee: null
        };
        runInAction(() => {
            this.currentDryrunResult = minimalResult;
        });
        return minimalResult;
    };

    @action
    public initiateSpliceIn = async (
        request: SpliceInRequest
    ): Promise<SpliceDryrunResult | null> => {
        const channelStateCheck = this.validateChannelState(request.channelId);
        if (!channelStateCheck.isValid) {
            runInAction(() => {
                this.error = channelStateCheck.error;
                this.loading = false;
            });
            return null;
        }

        if (BackendUtils.supportsSpliceDryrun()) {
            return this.performDryrun(request, SpliceOperationType.IN);
        }

        const minimalResult: SpliceDryrunResult = {
            txid: '',
            fee: null
        };
        runInAction(() => {
            this.currentDryrunResult = minimalResult;
        });
        return minimalResult;
    };

    @action
    private performDryrun = async (
        request: SpliceOutRequest | SpliceInRequest,
        type: SpliceOperationType
    ): Promise<SpliceDryrunResult | null> => {
        this.loading = true;
        this.error = null;

        try {
            const response =
                type === SpliceOperationType.OUT
                    ? await BackendUtils.spliceOut({
                          ...request,
                          dryrun: true
                      })
                    : await BackendUtils.spliceIn({
                          ...request,
                          dryrun: true
                      });

            const dryrunResult: SpliceDryrunResult = {
                txid: response.txid || '',
                psbt: response.psbt,
                tx: response.tx,
                fee: response.fee ?? null,
                transcript: response.transcript,
                script: response.script
            };

            runInAction(() => {
                this.currentDryrunResult = dryrunResult;
                this.loading = false;
            });

            return dryrunResult;
        } catch (error: any) {
            const errorMessage = this.parseErrorMessage(error);

            runInAction(() => {
                this.error = errorMessage;
                this.loading = false;
            });
            return null;
        }
    };

    @action
    public executeSplice = async (
        channelId: string,
        type: SpliceOperationType,
        previousLocalBalance: string,
        amount: string,
        destination: string,
        fee: number,
        forceFeerate: boolean = false,
        feeRate?: number
    ): Promise<SpliceExecutionResult | null> => {
        this.loading = true;
        this.error = null;

        const channelStateCheck = this.validateChannelState(channelId);
        if (!channelStateCheck.isValid) {
            runInAction(() => {
                this.error = channelStateCheck.error;
                this.loading = false;
            });
            return null;
        }

        if (this.transactionsStore) {
            runInAction(() => {
                this.transactionsStore.loading = true;
                this.transactionsStore.crafting = false;
                this.transactionsStore.error = false;
                this.transactionsStore.error_msg = null;
                this.transactionsStore.txid = null;
                this.transactionsStore.publishSuccess = false;
            });
        }

        try {
            const response =
                type === SpliceOperationType.OUT
                    ? await BackendUtils.spliceOut({
                          channelId,
                          amount,
                          destination,
                          forceFeerate,
                          feeRate,
                          dryrun: false
                      })
                    : await BackendUtils.spliceIn({
                          channelId,
                          amount,
                          forceFeerate,
                          feeRate,
                          dryrun: false
                      });

            const executionResult: SpliceExecutionResult = {
                txid: response.txid || '',
                psbt: response.psbt,
                tx: response.tx,
                script: response.script
            };

            const spliceOp: SpliceOperation = {
                channelId,
                txid: executionResult.txid,
                type,
                status: SpliceStatus.CONFIRMING,
                amount,
                destination,
                fee,
                script: executionResult.script,
                startedAt: Date.now(),
                confirmations: 0,
                previousLocalBalance
            };

            runInAction(() => {
                this.activeSplices.set(channelId, spliceOp);
                this.currentDryrunResult = null;
                this.loading = false;

                this.transactionsStore.txid = executionResult.txid;
                this.transactionsStore.publishSuccess = true;
                this.transactionsStore.loading = false;
            });

            return executionResult;
        } catch (error: any) {
            const errorMessage = this.parseErrorMessage(error);

            runInAction(() => {
                this.error = errorMessage;
                this.loading = false;

                this.transactionsStore.error = true;
                this.transactionsStore.error_msg = errorMessage;
                this.transactionsStore.loading = false;

                const failedOp: SpliceOperation = {
                    channelId,
                    txid: null,
                    type,
                    status: SpliceStatus.FAILED,
                    amount,
                    destination,
                    fee,
                    startedAt: Date.now(),
                    confirmations: 0,
                    error: errorMessage,
                    previousLocalBalance
                };
                this.activeSplices.set(channelId, failedOp);
            });
            return null;
        }
    };

    @action
    public updateConfirmations = (channelId: string, confirmations: number) => {
        const splice = this.activeSplices.get(channelId);
        if (splice) {
            splice.confirmations = confirmations;

            if (
                confirmations >= 1 &&
                splice.status === SpliceStatus.CONFIRMING
            ) {
                splice.status = SpliceStatus.COMPLETED;
                setTimeout(() => {
                    this.clearSplice(channelId);
                }, SPLICE_CLEANUP_INTERVAL);
            }
        }
    };

    @action
    public checkTransactionConfirmations = (transactions: any[]) => {
        for (const [channelId, splice] of this.activeSplices.entries()) {
            if (splice.status === SpliceStatus.CONFIRMING && splice.txid) {
                const tx = transactions.find(
                    (t: any) =>
                        (t.txid === splice.txid || t.tx_hash === splice.txid) &&
                        t.num_confirmations > 0
                );

                if (tx) {
                    this.updateConfirmations(channelId, tx.num_confirmations);
                }
            }
        }
    };

    @action
    public clearSplice = (channelId: string) => {
        this.activeSplices.delete(channelId);
    };

    public isChannelSplicing = (channelId: string): boolean => {
        const splice = this.activeSplices.get(channelId);
        return (
            splice !== undefined &&
            (splice.status === SpliceStatus.EXECUTING ||
                splice.status === SpliceStatus.CONFIRMING)
        );
    };

    public getPendingBalance = (channelId: string): string | null => {
        const splice = this.activeSplices.get(channelId);
        if (splice && this.isChannelSplicing(channelId)) {
            if (splice.type === SpliceOperationType.OUT && splice.fee > 0) {
                const previous = parseInt(splice.previousLocalBalance || '0');
                const amount = parseInt(splice.amount);
                const fee = splice.fee;
                return (previous - amount - fee).toString();
            }
        }
        return null;
    };

    public getSpliceOperation = (channelId: string): SpliceOperation | null => {
        return this.activeSplices.get(channelId) || null;
    };

    private validateChannelState = (
        channelId: string
    ): { isValid: boolean; error: string } => {
        const channel = this.channelsStore.channels.find(
            (ch) => ch.channelId === channelId || ch.chan_id === channelId
        );

        if (!channel) {
            return { isValid: false, error: 'Channel not found' };
        }

        if (
            channel.state === 'CLOSED' ||
            channel.state === 'NONE' ||
            channel.state === 'ONCHAIN'
        ) {
            return {
                isValid: false,
                error: 'Channel is not available for splicing'
            };
        }

        return { isValid: true, error: '' };
    };

    private parseErrorMessage = (error: any): string => {
        let errorMessage = 'Operation failed';

        try {
            if (!error) {
                return errorMessage;
            }

            let rawMessage = error.message || error.toString();

            while (
                typeof rawMessage === 'string' &&
                (rawMessage.startsWith('{') || rawMessage.startsWith('['))
            ) {
                try {
                    const parsedError = JSON.parse(rawMessage);
                    const nextMessage =
                        parsedError.message || parsedError.error || parsedError;

                    if (
                        nextMessage === rawMessage ||
                        typeof nextMessage !== 'string'
                    ) {
                        break;
                    }
                    rawMessage = nextMessage;
                } catch (parseError) {
                    break;
                }
            }

            const finalMessage = String(rawMessage);

            if (
                finalMessage.includes('insufficient fee') ||
                finalMessage.includes('error code: -26')
            ) {
                errorMessage =
                    'Insufficient fee. The fee rate might be too low for current network conditions. Try enabling force feerate or use a higher fee rate.';
            } else if (finalMessage.includes('rejecting replacement')) {
                errorMessage =
                    'Transaction replacement rejected. The new fee rate must be higher than the existing transaction. Try with a higher fee rate.';
            } else if (
                finalMessage.includes('Peer does not support splicing') ||
                finalMessage.includes('ChannelSplicingFailed')
            ) {
                errorMessage = 'The peer does not support splicing operations.';
            } else if (
                finalMessage.includes('timeout') ||
                finalMessage.includes('timed out')
            ) {
                errorMessage = 'Operation timed out. Please try again.';
            } else if (finalMessage.includes('not enough funds')) {
                errorMessage = 'Insufficient funds for this operation.';
            } else if (finalMessage.includes('Error broadcasting')) {
                errorMessage =
                    'Failed to broadcast transaction. Please check network conditions and try again.';
            } else if (finalMessage.length > 10) {
                errorMessage = finalMessage;
            }
        } catch (parseError) {
            errorMessage =
                error?.message || error?.toString() || 'Operation failed';
        }

        return errorMessage;
    };

    @action
    public reset = () => {
        this.activeSplices.clear();
        this.loading = false;
        this.error = null;
        this.currentDryrunResult = null;
    };
}
