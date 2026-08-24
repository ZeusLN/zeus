import BrantaStore from './BrantaStore';
import type SettingsStore from './SettingsStore';

const platform = {
    platform: 'Peony Lane',
    platform_logo_url: 'https://guardrail.branta.pro/logo.png'
};

const cases = [
    {
        name: 'ZK on-chain QR',
        qrCode: 'bitcoin:bc1q6745z6cy3u0k9nprurh3x804c4r7u3u8vxca2n?branta_id=z15b5EsbP5LHJrFco38%2BFp%2BHVaiopAY676NCKek8e1Q%2B4a370TyYhvloS8uLCUHfJ4CzeI%2FbOFmFDGpAQszB0gu1pJ1HOQ%3D%3D&branta_secret=c6e9eb30-6258-4432-9847-bdcc4fd4b0db',
        payment: {
            ...platform,
            description: 'Branta Developer On-Chain Zero Knowledge Example',
            destinations: [
                {
                    value: 'z15b5EsbP5LHJrFco38+Fp+HVaiopAY676NCKek8e1Q+4a370TyYhvloS8uLCUHfJ4CzeI/bOFmFDGpAQszB0gu1pJ1HOQ==',
                    type: 'bitcoin_address',
                    zk: true
                }
            ]
        }
    },
    {
        name: 'ZK Lightning QR',
        qrCode: 'lightning:lnbc17760n1p4r4flypp5k56kq3v2935rl3glkqu9vngfueud2zj87hjcff3t0kn0yrge0pfqdzjgfexzmn5vysz6gzyv4mx2mr0wpjhygzvd9nksarwd9hxwgz6v4ex7gztdehhwmr9v3nk2gz90psk6urvv5cqzzsxq97zvuqsp5hut3t0l0s5mvp9yr06v4253kqtf452z6c65s6g9sga445hc03v6s9qxpqysgqqm430zkk9uymjgvllr3aha88hc6q59etxasfqswn8r8pfm3dstlpp46azv906xtcj3wzprxup5fxn65a5wymt7zzq9sw9qdzx8rgdhcpk80nrg',
        payment: {
            ...platform,
            description: 'Branta Developer Lightning Zero Knowledge Example',
            destinations: [
                {
                    value: '6x8c86cTKdFrl0bCX1DmJvEMtmQUjOKKasBHbvlhj/Z0zSp6KCMXrLWpMLfCrwYlDDeb+j0KmxDam5wSXl2wtkkUAU0YZ4TuWWC9zQJ0RpCi1R1M+amr2kJGPsoS5wRmJ4+wkQBnTdLpNEXT8BqySNnfsZOSjD3a/vsCO2EjKPp7Osekzl+piwJowGyTuXnuBnpHCIEXcj7hVrcCYyXGVnnDCR5AxqTyj+3wVXBLIGpb33EUXrL69/aLjLgdHaCOdYkIbvQR0AkE7iEWeGezJVKRlfz9sxL3+cdpCZnfn/fa1R9+Eof7C6YZ0ItgSOCcyhS6rUKiDQNLqI0epgDjOi4sd5iQlW1fuKptwo5k2Dj2IYFd1rhnKf+PJOJ0r6bHL8fCDYh78bEYuhtczTvCu0XpDSITSrAeF9zvpintzxwLG2ufm4pZtHAY5YI90oSI940JMf1oFL0T8busTOZCTvYLni1Ihz9z4KePhWBqB6u/jo47Lw==',
                    type: 'bolt11',
                    zk: true
                }
            ]
        }
    }
];

describe('BrantaStore', () => {
    const originalCrypto = globalThis.crypto;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: {
                getRandomValues: (values: Uint8Array) => values
            }
        });
    });

    afterEach(() => {
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: originalCrypto
        });
        Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            value: originalFetch
        });
    });

    it.each(cases)(
        'verifies $name without crypto.subtle',
        async ({ qrCode, payment }) => {
            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                text: async () => JSON.stringify([payment])
            });
            Object.defineProperty(globalThis, 'fetch', {
                configurable: true,
                value: fetchMock
            });

            const store = new BrantaStore({} as SettingsStore);
            const result = await store.verifyPayment(qrCode);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(result).toMatchObject({
                platform: payment.platform,
                description: payment.description
            });
            expect(result?.verifyUrl).toContain(
                'https://guardrail.branta.pro/v2/verify/'
            );
        }
    );
});
