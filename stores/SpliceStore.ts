import { action, observable, runInAction } from 'mobx';
import SpliceScriptBuilder from '../utils/SpliceScriptBuilder';
import BackendUtils from '../utils/BackendUtils';
import {
    SpliceOutRequest,
    SpliceDryrunResult,
    SpliceExecutionResult
} from '../models/SpliceRequest';
import {
    SpliceOperation,
    SpliceOperationType,
    SpliceStatus
} from '../models/SpliceOperation';

export default class SpliceStore {
    @observable public activeSplices: Map<string, SpliceOperation> = new Map();
    @observable public loading = false;
    @observable public error: string | null = null;
    @observable public currentDryrunResult: SpliceDryrunResult | null = null;

    @action
    public initiateSpliceOut = async (
        request: SpliceOutRequest
    ): Promise<SpliceDryrunResult | null> => {
        this.loading = true;
        this.error = null;

        try {
            const script = SpliceScriptBuilder.buildSpliceOut(request);
            console.log('[SpliceStore] Generated script:', script);

            const response = await BackendUtils.devSplice(
                script,
                true,
                request.forceFeerate || false
            );

            const fee = this.extractFeeFromResponse(response);

            const dryrunResult: SpliceDryrunResult = {
                txid: response.txid || '',
                psbt: response.psbt,
                tx: response.tx,
                fee,
                transcript: response.dryrun || [],
                script
            };

            runInAction(() => {
                this.currentDryrunResult = dryrunResult;
                this.loading = false;
            });

            return dryrunResult;
        } catch (error: any) {
            console.log('[SpliceStore] initiateSpliceOut error:', error);

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
        script: string,
        previousLocalBalance: string,
        amount: string,
        destination: string,
        fee: number,
        forceFeerate: boolean = false
    ): Promise<SpliceExecutionResult | null> => {
        this.loading = true;
        this.error = null;

        try {
            const response = await BackendUtils.devSplice(
                script,
                false,
                forceFeerate
            );

            const executionResult: SpliceExecutionResult = {
                txid: response.txid || '',
                psbt: response.psbt,
                tx: response.tx,
                script
            };

            const spliceOp: SpliceOperation = {
                channelId,
                txid: executionResult.txid,
                type: SpliceOperationType.OUT,
                status: SpliceStatus.CONFIRMING,
                amount,
                destination,
                fee,
                script,
                startedAt: Date.now(),
                confirmations: 0,
                previousLocalBalance
            };

            runInAction(() => {
                this.activeSplices.set(channelId, spliceOp);
                this.currentDryrunResult = null;
                this.loading = false;
            });

            return executionResult;
        } catch (error: any) {
            console.log('[SpliceStore] executeSplice error:', error);

            const errorMessage = this.parseErrorMessage(error);

            runInAction(() => {
                this.error = errorMessage;
                this.loading = false;

                const failedOp: SpliceOperation = {
                    channelId,
                    txid: null,
                    type: SpliceOperationType.OUT,
                    status: SpliceStatus.FAILED,
                    amount,
                    destination,
                    fee,
                    script,
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
            }
        }
    };

    @action
    public completeSplice = (channelId: string) => {
        const splice = this.activeSplices.get(channelId);
        if (splice) {
            splice.status = SpliceStatus.COMPLETED;
        }
    };

    @action
    public clearSplice = (channelId: string) => {
        this.activeSplices.delete(channelId);
    };

    @action
    public revertFailedSplice = (channelId: string): string | null => {
        const splice = this.activeSplices.get(channelId);
        if (splice && splice.status === SpliceStatus.FAILED) {
            const previousBalance = splice.previousLocalBalance || null;
            this.activeSplices.delete(channelId);
            return previousBalance;
        }
        return null;
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
            if (splice.type === SpliceOperationType.OUT) {
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

    private extractFeeFromResponse = (response: any): number => {
        if (response.dryrun && Array.isArray(response.dryrun)) {
            for (const line of response.dryrun) {
                const feeMatch = line.match(/fee[:\s]+(\d+)\s*sat/i);
                if (feeMatch) {
                    return parseInt(feeMatch[1]);
                }
            }
        }
        return 250;
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
                finalMessage.includes('Peer does not support splicing')
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
            console.error(
                '[SpliceStore] Error parsing error message:',
                parseError
            );
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
