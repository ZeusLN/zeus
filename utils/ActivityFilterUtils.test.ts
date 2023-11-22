jest.mock('dateformat', () => ({}));
jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));

import Payment from '../models/Payment';
import Invoice from '../models/Invoice';
import Transaction from '../models/Transaction';
import { Filter } from '../stores/ActivityStore';
import ActivityFilterUtils from './ActivityFilterUtils';

describe('ActivityFilterUtils', () => {
    it('supports filtering by start date', () => {
        const filterStartDate = new Date(2000, 1, 2, 3, 4, 5);
        const activities: any[] = [
            new Transaction({
                amount: 1,
                time_stamp: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString()
            }),
            new Transaction({
                amount: 2,
                time_stamp: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString()
            }),
            new Invoice({
                value: '3',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString()
            }),
            new Invoice({
                value: '4',
                creation_date: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString()
            }),
            new Payment({
                value: '5',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString()
            }),
            new Payment({
                value: '6',
                creation_date: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString()
            })
        ];
        const filter = getDefaultFilter();
        filter.startDate = filterStartDate;

        const filteredActivities = ActivityFilterUtils.filterActivities(
            activities,
            filter
        );

        expect(filteredActivities.map((a) => a.getAmount)).toEqual([
            '2',
            4,
            '6'
        ]);
    });

    it('supports filtering by end date', () => {
        const filterEndDate = new Date(2000, 1, 1, 3, 4, 5);
        const activities: any[] = [
            new Transaction({
                amount: 1,
                time_stamp: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString()
            }),
            new Transaction({
                amount: 2,
                time_stamp: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString()
            }),
            new Invoice({
                value: '3',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString()
            }),
            new Invoice({
                value: '4',
                creation_date: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString()
            }),
            new Payment({
                value: '5',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString()
            }),
            new Payment({
                value: '6',
                creation_date: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString()
            })
        ];
        const filter = getDefaultFilter();
        filter.endDate = filterEndDate;

        const filteredActivities = ActivityFilterUtils.filterActivities(
            activities,
            filter
        );

        expect(filteredActivities.map((a) => a.getAmount)).toEqual([
            '1',
            3,
            '5'
        ]);
    });

    it('supports filtering unconfirmed transactions', () => {
        const activities: any[] = [
            new Transaction({
                amount: 1,
                time_stamp: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString(),
                num_confirmations: 1
            }),
            new Transaction({
                amount: 2,
                time_stamp: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString(),
                num_confirmations: 0
            }),
            new Transaction({
                amount: 3,
                time_stamp: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString(),
                status: 'confirmed'
            }),
            new Transaction({
                amount: 4,
                time_stamp: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString(),
                status: 'unconfirmed'
            }),
            new Invoice({
                value: '5',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString()
            }),
            new Payment({
                value: '6',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString()
            })
        ];
        const filter = getDefaultFilter();
        filter.unconfirmed = false;

        const filteredActivities = ActivityFilterUtils.filterActivities(
            activities,
            filter
        );

        expect(filteredActivities.map((a) => a.getAmount)).toEqual([
            '1',
            '3',
            5,
            '6'
        ]);
    });

    const getDefaultFilter = () =>
        ({
            lightning: true,
            onChain: true,
            sent: true,
            received: true,
            unpaid: true,
            unconfirmed: true,
            minimumAmount: 0
        } as Filter);
});
