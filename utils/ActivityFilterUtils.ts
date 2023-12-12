import moment from 'moment';
import { Filter } from '../stores/ActivityStore';
import { localeString } from './LocaleUtils';
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
                (activity) =>
                    !(
                        activity instanceof Transaction &&
                        Number(activity.getAmount) != 0
                    )
            );
        }

        if (filter.sent == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(
                        (activity instanceof Transaction &&
                            Number(activity.getAmount) < 0) ||
                        activity instanceof Payment
                    )
            );
        }

        if (filter.received == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(
                        (activity instanceof Transaction &&
                            Number(activity.getAmount) > 0) ||
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

        if (filter.unconfirmed == false) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    !(activity instanceof Transaction) || activity.isConfirmed
            );
        }

        if (filter.zeusPay == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model ===
                            localeString('views.Invoice.title') &&
                        activity.isZeusPay
                    )
            );
        }

        if (filter.minimumAmount > 0) {
            filteredActivity = filteredActivity.filter(
                (activity) =>
                    Math.abs(Number(activity.getAmount)) >= filter.minimumAmount
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

        return filteredActivity;
    }
}

const activityFilterUtils = new ActivityFilterUtils();
export default activityFilterUtils;
