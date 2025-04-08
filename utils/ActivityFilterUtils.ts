import moment from 'moment';
import { Filter } from '../stores/ActivityStore';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import Transaction from '../models/Transaction';

class ActivityFilterUtils {
    public filterActivities(
        activities: Array<Invoice | Payment | Transaction>,
        filter: Filter
    ): Array<Invoice | Payment | Transaction> {
        let filteredActivity = activities;
        if (filter.lightning == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(
                        activity instanceof Invoice ||
                        activity instanceof Payment
                    )
            );
        }

        if (filter.onChain == false) {
            filteredActivity = filteredActivity.filter(
                (activity) => !(activity instanceof Transaction)
            );
        }

        if (filter.sent == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(
                        (activity instanceof Transaction &&
                            Number(activity.getAmount) <= 0) ||
                        activity instanceof Payment
                    )
            );
        }

        if (filter.received == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(
                        (activity instanceof Transaction &&
                            Number(activity.getAmount) >= 0) ||
                        (activity instanceof Invoice && activity.isPaid)
                    )
            );
        }

        if (filter.unpaid == false) {
            filteredActivity = filteredActivity.filter(
                (activity) => !(activity instanceof Invoice && !activity.isPaid)
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
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(activity instanceof Payment && activity.getKeysendMessage)
            );
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
            filteredActivity = filteredActivity.filter(
                (activity) => activity.getDate.getTime() >= startDate.getTime()
            );
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
            filteredActivity = filteredActivity.filter(
                (activity) => activity.getDate.getTime() < endDate.getTime()
            );
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
