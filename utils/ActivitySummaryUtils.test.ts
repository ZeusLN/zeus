jest.mock('dateformat', () => ({}));
jest.mock('./LocaleUtils', () => ({
    localeString: (s: string) => s
}));

jest.mock('../stores/Stores', () => ({
    notesStore: {
        notes: {}
    }
}));

import Invoice from '../models/Invoice';
import Payment from '../models/Payment';
import { ActivityItem, Filter } from '../stores/ActivityStore';
import ActivitySummaryUtils from './ActivitySummaryUtils';

describe('ActivitySummaryUtils', () => {
    const createPayment = (data: any, memo = '') => {
        return new Payment({
            ...data,
            htlcs: memo
                ? [
                      {
                          status: 'SUCCEEDED',
                          route: {
                              total_amt: Number(data.value),
                              hops: [
                                  {
                                      custom_records: {
                                          '34349334': Buffer.from(
                                              memo,
                                              'utf8'
                                          ).toString('base64')
                                      }
                                  }
                              ]
                          }
                      }
                  ]
                : undefined
        });
    };

    it('groups filtered lightning payments by memo, destination, and day', () => {
        const activities: ActivityItem[] = [
            createPayment(
                {
                    value: '100',
                    destination: 'dest-a',
                    creation_date: (
                        new Date(2026, 0, 2, 2, 0, 0).getTime() / 1000
                    ).toString()
                },
                'EV charging'
            ),
            createPayment(
                {
                    value: '200',
                    destination: 'dest-a',
                    creation_date: (
                        new Date(2026, 0, 2, 3, 0, 0).getTime() / 1000
                    ).toString()
                },
                'EV charging'
            ),
            createPayment(
                {
                    value: '300',
                    destination: 'dest-b',
                    creation_date: (
                        new Date(2026, 0, 2, 4, 0, 0).getTime() / 1000
                    ).toString()
                },
                'EV charging'
            )
        ];

        const filter = {
            activitySummary: true,
            activitySummaryInterval: 'day',
            activitySummaryGroupBy: 'memoAndDestination'
        } as Filter;

        const summaries = ActivitySummaryUtils.summarizeActivities(
            activities,
            filter
        );

        expect(summaries).toHaveLength(2);
        expect(
            summaries.find(
                (summary) => summary.groupLabel === 'EV charging · dest-a'
            )
        ).toMatchObject({
            groupLabel: 'EV charging · dest-a',
            count: 2,
            totalAmount: -300,
            intervalLabel: '2026-01-02'
        });
        expect(
            summaries.find(
                (summary) => summary.groupLabel === 'EV charging · dest-b'
            )
        ).toMatchObject({
            groupLabel: 'EV charging · dest-b',
            count: 1,
            totalAmount: -300,
            intervalLabel: '2026-01-02'
        });
    });

    it('groups payments by memo and hour', () => {
        const activities: ActivityItem[] = [
            createPayment(
                {
                    value: '25',
                    creation_date: (
                        new Date(2026, 0, 2, 2, 0, 0).getTime() / 1000
                    ).toString()
                },
                'Podcast stream'
            ),
            createPayment(
                {
                    value: '50',
                    creation_date: (
                        new Date(2026, 0, 2, 2, 30, 0).getTime() / 1000
                    ).toString()
                },
                'Podcast stream'
            ),
            createPayment(
                {
                    value: '100',
                    creation_date: (
                        new Date(2026, 0, 2, 3, 0, 0).getTime() / 1000
                    ).toString()
                },
                'Podcast stream'
            ),
            new Invoice({
                memo: 'Podcast stream',
                value: '25',
                creation_date: (
                    new Date(2026, 0, 2, 2, 0, 0).getTime() / 1000
                ).toString()
            })
        ];

        const filter = {
            activitySummary: true,
            activitySummaryInterval: 'hour',
            activitySummaryGroupBy: 'memo'
        } as Filter;

        const summaries = ActivitySummaryUtils.summarizeActivities(
            activities,
            filter
        );

        expect(summaries).toHaveLength(2);
        expect(
            summaries.find(
                (summary) => summary.intervalLabel === '2026-01-02 02:00'
            )
        ).toMatchObject({
            groupLabel: 'Podcast stream',
            count: 2,
            totalAmount: -75,
            intervalLabel: '2026-01-02 02:00'
        });
    });

    it('nets sent payments against received paid invoices', () => {
        const activities: ActivityItem[] = [
            createPayment(
                {
                    value: '100',
                    creation_date: (
                        new Date(2026, 0, 2, 2, 0, 0).getTime() / 1000
                    ).toString()
                },
                'Refundable stream'
            ),
            new Invoice({
                memo: 'Refundable stream',
                value: '100',
                num_satoshis: '100',
                state: 'settled',
                settled_at: (
                    new Date(2026, 0, 2, 2, 30, 0).getTime() / 1000
                ).toString()
            })
        ];

        const filter = {
            activitySummary: true,
            activitySummaryInterval: 'day',
            activitySummaryGroupBy: 'memo'
        } as Filter;

        const summaries = ActivitySummaryUtils.summarizeActivities(
            activities,
            filter
        );

        expect(summaries).toHaveLength(1);
        expect(summaries[0]).toMatchObject({
            groupLabel: 'Refundable stream',
            count: 2,
            totalAmount: 0,
            intervalLabel: '2026-01-02'
        });
    });

    it('returns no summaries when disabled', () => {
        const filter = {
            activitySummary: false
        } as Filter;

        const summaries = ActivitySummaryUtils.summarizeActivities(
            [
                createPayment({
                    value: '100',
                    creation_date: (
                        new Date(2026, 0, 2, 2, 0, 0).getTime() / 1000
                    ).toString()
                })
            ],
            filter
        );

        expect(summaries).toEqual([]);
    });
});
