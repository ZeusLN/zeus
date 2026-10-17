const mockStorage: Record<string, string> = {};
jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => mockStorage[key]),
        setItem: jest.fn(async (key: string, value: string) => {
            mockStorage[key] = value;
        })
    }
}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./FiatStore', () => ({}));

import UnitsStore, { UNIT_KEY } from './UnitsStore';

// a start of the app: only what is in storage survives
const start = async (settings: any = { fiatEnabled: true }) => {
    const store = new UnitsStore({ settings } as any, {} as any);
    await store.getUnits();
    return store;
};

describe('UnitsStore', () => {
    beforeEach(() => {
        delete mockStorage[UNIT_KEY];
    });

    describe('setUnits', () => {
        it('survives a restart', async () => {
            const store = await start();
            await store.setUnits('fiat');
            await store.setUnits('sats');
            expect(mockStorage[UNIT_KEY]).toBe('sats');
            expect((await start()).units).toBe('sats');
        });
    });

    describe('getUnits', () => {
        it('restores the stored unit', async () => {
            mockStorage[UNIT_KEY] = 'BTC';
            expect((await start()).units).toBe('BTC');
        });

        it('keeps fiat while fiat is on', async () => {
            mockStorage[UNIT_KEY] = 'fiat';
            expect((await start()).units).toBe('fiat');
            expect(mockStorage[UNIT_KEY]).toBe('fiat');
        });

        it('falls back to sats when fiat is stored but switched off', async () => {
            mockStorage[UNIT_KEY] = 'fiat';
            const store = await start({ fiatEnabled: false });
            expect(store.units).toBe('sats');
            expect(mockStorage[UNIT_KEY]).toBe('sats');
        });

        it('leaves BTC alone when fiat is switched off', async () => {
            mockStorage[UNIT_KEY] = 'BTC';
            const store = await start({ fiatEnabled: false });
            expect(store.units).toBe('BTC');
            expect(mockStorage[UNIT_KEY]).toBe('BTC');
        });
    });
});
