import moment from 'moment';
import { Filter } from '../stores/ActivityStore';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';
import CashuInvoice from '../models/CashuInvoice';
import CashuPayment from '../models/CashuPayment';
import CashuToken from '../models/CashuToken';
import WithdrawalRequest from '../models/WithdrawalRequest';
import Swap from '../models/Swap';
import { LSPOrderState } from '../models/LSP';

class ActivityFilterUtils {
    public filterActivities(
        activities: Array<any>,
        filter: Filter
    ): Array<any> {
        let filteredActivity = activities;
        if (filter.lightning == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(
                        activity instanceof Invoice ||
                        activity instanceof WithdrawalRequest ||
                        activity instanceof Payment
                    )
            );
        }

        if (filter.onChain == false) {
            filteredActivity = filteredActivity.filter(
                (activity) => !(activity instanceof Transaction)
            );
        }

        if (filter.cashu == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(
                        activity instanceof CashuInvoice ||
                        activity instanceof CashuPayment ||
                        activity instanceof CashuToken
                    )
            );
        }

        if (filter.swaps == false) {
            filteredActivity = filteredActivity.filter(
                (activity) => !(activity instanceof Swap)
            );
        } else {
            filteredActivity = filteredActivity.filter((activity) => {
                if (!(activity instanceof Swap)) return true;

                return filter.swapState[activity.status] === true;
            });
        }

        if (filter.lsps1 == false) {
            filteredActivity = filteredActivity.filter(
                (activity) => activity.model !== 'LSPS1Order'
            );
        } else {
            filteredActivity = filteredActivity.filter((activity) => {
                if (activity.model !== 'LSPS1Order') return true;

                const state = activity.state as LSPOrderState;
                if (
                    filter.lsps1State[LSPOrderState.CREATED] &&
                    state === LSPOrderState.CREATED
                )
                    return true;
                if (
                    filter.lsps1State[LSPOrderState.COMPLETED] &&
                    state === LSPOrderState.COMPLETED
                )
                    return true;
                if (
                    filter.lsps1State[LSPOrderState.FAILED] &&
                    state === LSPOrderState.FAILED
                )
                    return true;

                return false;
            });
        }

        if (filter.lsps7 === false) {
            filteredActivity = filteredActivity.filter(
                (activity) => activity.model !== 'LSPS7Order'
            );
        } else {
            filteredActivity = filteredActivity.filter((activity) => {
                if (activity.model !== 'LSPS7Order') return true;

                const state = activity.state as LSPOrderState;
                if (
                    filter.lsps7State[LSPOrderState.CREATED] &&
                    state === LSPOrderState.CREATED
                )
                    return true;
                if (
                    filter.lsps7State[LSPOrderState.COMPLETED] &&
                    state === LSPOrderState.COMPLETED
                )
                    return true;
                if (
                    filter.lsps7State[LSPOrderState.FAILED] &&
                    state === LSPOrderState.FAILED
                )
                    return true;

                return false;
            });
        }

        if (filter.sent == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(
                        (activity instanceof Transaction &&
                            Number(activity.getAmount) <= 0) ||
                        activity instanceof Payment ||
                        activity instanceof CashuPayment ||
                        (activity instanceof CashuToken && activity.sent)
                    )
            );
        }

        if (filter.received == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(
                        (activity instanceof Transaction &&
                            Number(activity.getAmount) >= 0) ||
                        (activity instanceof Invoice && activity.isPaid) ||
                        (activity instanceof CashuInvoice && activity.isPaid) ||
                        (activity instanceof CashuToken && activity.received)
                    )
            );
        }

        if (filter.unpaid == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(activity instanceof Invoice && !activity.isPaid) &&
                    !(activity instanceof CashuInvoice && !activity.isPaid)
            );
        }

        if (filter.inTransit == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(activity instanceof Payment && activity.isInTransit)
            );
        }

        if (filter.isFailed == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(activity instanceof Payment && activity.isFailed)
            );
        }

        if (filter.unconfirmed == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(activity instanceof Transaction && !activity.isConfirmed)
            );
        }

        if (filter.standardInvoices == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(activity instanceof Invoice && !activity.is_amp)
            );
        }

        if (filter.ampInvoices == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(activity instanceof Invoice && activity.is_amp)
            );
        }

        if (filter.zeusPay == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(activity instanceof Invoice && activity.isZeusPay)
            );
        }

        if (filter.keysend == false) {
            filteredActivity = filteredActivity.filter((activity: any) => {
                const isPayment = activity instanceof Payment;
                const isInvoice = activity instanceof Invoice;
                return (
                    !(isPayment && activity.isKeysend) &&
                    !(isInvoice && activity.isKeysend)
                );
            });
        }

        if (filter.minimumAmount > 0) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    Math.abs(Number(activity.getAmount)) >= filter.minimumAmount
            );
        }

        if (filter.maximumAmount !== undefined) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    Math.abs(Number(activity.getAmount)) <=
                    (filter.maximumAmount ?? Infinity)
            );
        }

        if (filter.startDate) {
            const startDate = new Date(
                filter.startDate.getFullYear(),
                filter.startDate.getMonth(),
                filter.startDate.getDate()
            );
            filteredActivity = filteredActivity.filter((activity) => {
                if (activity instanceof WithdrawalRequest) {
                    return true;
                }
                return activity.getDate.getTime() >= startDate.getTime();
            });
        }

        if (filter.endDate) {
            const endDate = moment(
                new Date(
                    filter.endDate.getFullYear(),
                    filter.endDate.getMonth(),
                    filter.endDate.getDate()
                )
            )
                .add(1, 'day')
                .toDate();
            filteredActivity = filteredActivity.filter((activity) => {
                if (activity instanceof WithdrawalRequest) {
                    return true;
                }
                return activity.getDate.getTime() < endDate.getTime();
            });
        }
        if (filter.memo !== '') {
            const memoFilter = filter.memo.toLowerCase();

            filteredActivity = filteredActivity.filter((activity) => {
                let note = activity.getNote
                    ? activity.getNote.toLowerCase()
                    : '';
                let memo = '';
                if (activity instanceof Invoice) {
                    memo = activity.memo ? activity.memo.toLowerCase() : '';
                } else if (activity instanceof Payment) {
                    memo = activity.getMemo
                        ? activity.getMemo.toLowerCase()
                        : '';
                }
                return note.includes(memoFilter) || memo.includes(memoFilter);
            });
        }

        return filteredActivity;
    }
}

const activityFilterUtils = new ActivityFilterUtils();
export default activityFilterUtils;
