jest.mock('dateformat', () => ({}));
jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../stores/Stores', () => ({
    NotesStore: {
        notes: []
    }
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
    // New test case for maximumAmount filtering
    it('supports filtering by maximum amount', () => {
        const activities: any[] = [
            new Invoice({
                value: '100',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString()
            }),
            new Payment({
                value: '200',
                creation_date: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString()
            }),
            new Payment({
                value: '300',
                creation_date: (
                    new Date(2000, 1, 3, 3, 4, 4).getTime() / 1000
                ).toString()
            })
        ];

        const filter = getDefaultFilter();
        filter.maximumAmount = 250;

        const filteredActivities = ActivityFilterUtils.filterActivities(
            activities,
            filter
        );

        expect(filteredActivities.map((a) => Number(a.getAmount))).toEqual([
            100, 200
        ]);
    });

    // Test cases for keysend filtering
    it('supports filtering keysend payments and invoices', () => {
        const activities: any[] = [
            new Payment({
                value: '100',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString(),
                htlcs: [
                    {
                        route: {
                            hops: [
                                {
                                    custom_records: {
                                        '34349334': 'test message'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }),
            new Payment({
                value: '200',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 6).getTime() / 1000
                ).toString(),
                htlcs: [
                    {
                        route: {
                            hops: [
                                {
                                    custom_records: {
                                        '5482373484': 'test preimage'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }),
            new Payment({
                value: '300',
                creation_date: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString()
            }),
            new Invoice({
                value: '400',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString(),
                htlcs: [
                    {
                        custom_records: {
                            '34349334': 'test message'
                        }
                    }
                ]
            }),
            new Invoice({
                value: '500',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 6).getTime() / 1000
                ).toString(),
                htlcs: [
                    {
                        custom_records: {
                            '5482373484': 'test preimage'
                        }
                    }
                ]
            }),
            new Invoice({
                value: '600',
                creation_date: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString()
            })
        ];
        const filter = getDefaultFilter();
        filter.keysend = false;

        const filteredActivities = ActivityFilterUtils.filterActivities(
            activities,
            filter
        );

        expect(filteredActivities.map((a) => a.getAmount)).toEqual([
            '300',
            600
        ]);
    });

    //    test case for Memo Filter
    it('supports filtering by memo', () => {
        const activities: any[] = [
            {
                getNote: 'Payment for invoice'
            },
            {
                getNote: 'Refund issued'
            },
            {
                getNote: 'Monthly subscription'
            }
        ];

        const filter = getDefaultFilter();
        filter.memo = 'invoice';

        const filteredActivities = ActivityFilterUtils.filterActivities(
            activities,
            filter
        );

        expect(filteredActivities.length).toBe(1);
        expect(
            'getNote' in filteredActivities[0] && filteredActivities[0].getNote
        ).toBe('Payment for invoice');
    });

    // Test case for Keysend Filter
    it('supports filtering by keysend', () => {
        const activities: any[] = [
            new Payment({
                value: '100',
                creation_date: (
                    new Date(2000, 1, 1, 3, 4, 5).getTime() / 1000
                ).toString(),
                htlcs: [
                    {
                        route: {
                            hops: [
                                {
                                    custom_records: {
                                        '34349334':
                                            'Keysend payment with message'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }),
            new Payment({
                value: '200',
                creation_date: (
                    new Date(2000, 1, 2, 3, 4, 4).getTime() / 1000
                ).toString(),
                htlcs: [
                    {
                        route: {
                            hops: [
                                {
                                    custom_records: {
                                        '5482373484': 'Keysend preimage'
                                    }
                                }
                            ]
                        }
                    }
                ]
            }),
            new Invoice({
                value: '400',
                creation_date: (
                    new Date(2000, 1, 4, 3, 4, 4).getTime() / 1000
                ).toString(),
                htlcs: [
                    {
                        custom_records: {
                            '34349334': 'Keysend invoice with message'
                        }
                    }
                ]
            }),
            new Invoice({
                value: '500',
                creation_date: (
                    new Date(2000, 1, 5, 3, 4, 4).getTime() / 1000
                ).toString(),
                htlcs: [
                    {
                        custom_records: {
                            '5482373484': 'Keysend invoice preimage'
                        }
                    }
                ]
            }),
            new Payment({
                value: '600',
                creation_date: (
                    new Date(2000, 1, 6, 3, 4, 4).getTime() / 1000
                ).toString(),
                htlcs: []
            }),
            new Invoice({
                value: '700',
                creation_date: (
                    new Date(2000, 1, 7, 3, 4, 4).getTime() / 1000
                ).toString(),
                htlcs: []
            })
        ];

        const filter = getDefaultFilter();
        filter.keysend = false;

        const filteredActivities = ActivityFilterUtils.filterActivities(
            activities,
            filter
        );

        // Should only include non-keysend activities
        expect(filteredActivities.length).toBe(2);
        expect(filteredActivities.map((a) => a.getAmount)).toEqual([
            '600',
            700
        ]);
    });

    const getDefaultFilter = () =>
        ({
            lightning: true,
            onChain: true,
            cashu: true,
            sent: true,
            received: true,
            unpaid: true,
            unconfirmed: true,
            minimumAmount: 0,
            memo: '',
            keysend: true
        } as Filter);
});
