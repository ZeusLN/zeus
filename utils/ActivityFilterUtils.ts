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
                (activity: any) =>
                    !(
                        activity.model ===
                            localeString('views.Invoice.title') ||
                        activity.model === localeString('views.Payment.title')
                    )
            );
        }

        if (filter.onChain == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model ===
                            localeString('general.transaction') &&
                        activity.getAmount != 0
                    )
            );
        }

        if (filter.sent == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        (activity.model ===
                            localeString('general.transaction') &&
                            activity.getAmount < 0) ||
                        activity.model === localeString('views.Payment.title')
                    )
            );
        }

        if (filter.received == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        (activity.model ===
                            localeString('general.transaction') &&
                            activity.getAmount > 0) ||
                        (activity.model ===
                            localeString('views.Invoice.title') &&
                            activity.isPaid)
                    )
            );
        }

        if (filter.unpaid == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model ===
                            localeString('views.Invoice.title') &&
                        !activity.isPaid
                    )
            );
        }

        if (filter.inTransit == false) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    !(
                        activity.model ===
                            localeString('views.Payment.title') &&
                        activity.isInTransit
                    )
            );
        }

        if (filter.minimumAmount > 0) {
            filteredActivity = filteredActivity.filter(
                (activity: any) =>
                    Math.abs(activity.getAmount) >= filter.minimumAmount
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
