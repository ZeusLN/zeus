import moment from 'moment';

import { localeString } from './LocaleUtils';
import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import {
    ActivityItem,
    ActivitySummaryGroupBy,
    ActivitySummaryInterval,
    Filter
} from '../stores/ActivityStore';

type SummaryActivityItem = Invoice | Payment;

export interface ActivitySummary {
    id: string;
    interval: ActivitySummaryInterval;
    intervalStart: Date;
    intervalLabel: string;
    groupBy: ActivitySummaryGroupBy;
    groupLabel: string;
    memo?: string;
    destination?: string;
    count: number;
    totalAmount: number;
    items: SummaryActivityItem[];
}

class ActivitySummaryUtils {
    private getIntervalStart(
        date: Date,
        interval: ActivitySummaryInterval
    ): Date {
        return moment(date).startOf(interval).toDate();
    }

    private getIntervalLabel(
        date: Date,
        interval: ActivitySummaryInterval
    ): string {
        switch (interval) {
            case 'hour':
                return moment(date).format('YYYY-MM-DD HH:00');
            case 'month':
                return moment(date).format('YYYY-MM');
            case 'year':
                return moment(date).format('YYYY');
            case 'day':
            default:
                return moment(date).format('YYYY-MM-DD');
        }
    }

    private getMemo(item: SummaryActivityItem): string {
        const memo =
            item.getKeysendMessageOrMemo ||
            ('getNote' in item ? item.getNote : '') ||
            '';

        return memo.trim();
    }

    private getDestination(item: SummaryActivityItem): string {
        return item instanceof Payment ? item.getDestination || '' : '';
    }

    private getGroupLabel({
        memo,
        destination,
        groupBy
    }: {
        memo: string;
        destination: string;
        groupBy: ActivitySummaryGroupBy;
    }): string {
        const unknownMemo = localeString('views.ActivitySummary.noMemo');
        const unknownDestination = localeString(
            'views.ActivitySummary.noDestination'
        );

        if (groupBy === 'memo') {
            return memo || unknownMemo;
        }

        if (groupBy === 'destination') {
            return destination || unknownDestination;
        }

        if (memo && destination) return `${memo} · ${destination}`;
        return memo || destination || `${unknownMemo} · ${unknownDestination}`;
    }

    private getSummaryId({
        intervalStart,
        groupBy,
        memo,
        destination
    }: {
        intervalStart: Date;
        groupBy: ActivitySummaryGroupBy;
        memo: string;
        destination: string;
    }): string {
        const grouping =
            groupBy === 'memo'
                ? memo
                : groupBy === 'destination'
                ? destination
                : `${memo}:${destination}`;

        return `${intervalStart.toISOString()}:${groupBy}:${grouping}`;
    }

    public summarizeActivities(
        activities: ActivityItem[],
        filter: Filter
    ): ActivitySummary[] {
        if (!filter.activitySummary) return [];

        const interval = filter.activitySummaryInterval || 'day';
        const groupBy = filter.activitySummaryGroupBy || 'memoAndDestination';
        const summaryMap = new Map<string, ActivitySummary>();

        activities.forEach((item) => {
            if (
                !(item instanceof Payment) &&
                !(item instanceof Invoice && item.isPaid)
            ) {
                return;
            }

            const itemAmount = Number(item.getAmount);
            if (!Number.isFinite(itemAmount) || itemAmount === 0) return;

            const amount = item instanceof Payment ? -itemAmount : itemAmount;

            const intervalStart = this.getIntervalStart(item.getDate, interval);
            const intervalLabel = this.getIntervalLabel(
                intervalStart,
                interval
            );
            const memo = this.getMemo(item);
            const destination = this.getDestination(item);
            const id = this.getSummaryId({
                intervalStart,
                groupBy,
                memo,
                destination
            });
            const groupLabel = this.getGroupLabel({
                memo,
                destination,
                groupBy
            });
            const existing = summaryMap.get(id);

            if (existing) {
                existing.count += 1;
                existing.totalAmount += amount;
                existing.items.push(item);
                return;
            }

            summaryMap.set(id, {
                id,
                interval,
                intervalStart,
                intervalLabel,
                groupBy,
                groupLabel,
                memo,
                destination,
                count: 1,
                totalAmount: amount,
                items: [item]
            });
        });

        return Array.from(summaryMap.values()).sort((a, b) => {
            const timeDiff =
                b.intervalStart.getTime() - a.intervalStart.getTime();
            if (timeDiff !== 0) return timeDiff;
            return b.totalAmount - a.totalAmount;
        });
    }
}

const activitySummaryUtils = new ActivitySummaryUtils();
export default activitySummaryUtils;
