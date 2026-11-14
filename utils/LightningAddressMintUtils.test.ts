jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() }
}));
jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) =>
        ({
            'views.Cashu.LightningAddress.switchMint.message':
                '{{address}}: {{currentMint}} -> {{newMint}}',
            'views.Cashu.LightningAddress.switchMint.messageUnknownCurrent':
                '{{address}}: ? -> {{newMint}}'
        }[key] || key)
}));

import { Alert } from 'react-native';

import {
    getLightningAddressMintUrl,
    isSameMintUrl,
    offerLightningAddressMintSwitch,
    shouldOfferLightningAddressMintSwitch
} from './LightningAddressMintUtils';

const mockAlert = Alert.alert as jest.Mock;

const OLD_MINT = 'https://old.mint.test';
const NEW_MINT = 'https://new.mint.test';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('LightningAddressMintUtils', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('isSameMintUrl', () => {
        it('ignores trailing slashes and scheme/host case', () => {
            expect(isSameMintUrl(OLD_MINT, `${OLD_MINT}/`)).toBe(true);
            expect(isSameMintUrl(OLD_MINT, 'HTTPS://Old.Mint.Test')).toBe(true);
            expect(isSameMintUrl(` ${OLD_MINT} `, OLD_MINT)).toBe(true);
        });

        it('keeps the path case-sensitive', () => {
            expect(
                isSameMintUrl(
                    'https://mint.test/Bitcoin',
                    'https://mint.test/bitcoin'
                )
            ).toBe(false);
        });

        it('never matches an empty or missing URL', () => {
            expect(isSameMintUrl(undefined, undefined)).toBe(false);
            expect(isSameMintUrl('', '')).toBe(false);
            expect(isSameMintUrl(OLD_MINT, undefined)).toBe(false);
        });
    });

    describe('getLightningAddressMintUrl', () => {
        const settingsStore = (mintUrl?: string) =>
            ({ settings: { lightningAddress: { mintUrl } } } as any);

        it('returns the stored mint for a Cashu address', () => {
            expect(
                getLightningAddressMintUrl(
                    {
                        lightningAddress: 'hal@zeuspay.com',
                        lightningAddressType: 'cashu'
                    } as any,
                    settingsStore(OLD_MINT)
                )
            ).toBe(OLD_MINT);
        });

        it('returns nothing for an NWC address', () => {
            expect(
                getLightningAddressMintUrl(
                    {
                        lightningAddress: 'hal@zeuspay.com',
                        lightningAddressType: 'nwc'
                    } as any,
                    settingsStore(OLD_MINT)
                )
            ).toBeUndefined();
        });

        it('returns nothing without an address or a stored mint', () => {
            expect(
                getLightningAddressMintUrl(
                    { lightningAddressType: 'cashu' } as any,
                    settingsStore(OLD_MINT)
                )
            ).toBeUndefined();
            expect(
                getLightningAddressMintUrl(
                    {
                        lightningAddress: 'hal@zeuspay.com',
                        lightningAddressType: 'cashu'
                    } as any,
                    settingsStore('')
                )
            ).toBeUndefined();
        });
    });

    describe('shouldOfferLightningAddressMintSwitch', () => {
        const base = {
            lightningAddress: 'hal@zeuspay.com',
            lightningAddressType: 'cashu',
            addressMintUrl: OLD_MINT,
            newMintUrl: NEW_MINT
        };

        it('offers when a Cashu address uses a different mint', () => {
            expect(shouldOfferLightningAddressMintSwitch(base)).toBe(true);
        });

        it('offers when the address mint is unknown on this device', () => {
            expect(
                shouldOfferLightningAddressMintSwitch({
                    ...base,
                    addressMintUrl: undefined
                })
            ).toBe(true);
        });

        it('does not offer when the address already uses the mint', () => {
            expect(
                shouldOfferLightningAddressMintSwitch({
                    ...base,
                    newMintUrl: `${OLD_MINT}/`
                })
            ).toBe(false);
        });

        it('does not offer without a Lightning address', () => {
            expect(
                shouldOfferLightningAddressMintSwitch({
                    ...base,
                    lightningAddress: undefined
                })
            ).toBe(false);
        });

        it('does not offer for NWC or Zaplocker addresses', () => {
            expect(
                shouldOfferLightningAddressMintSwitch({
                    ...base,
                    lightningAddressType: 'nwc'
                })
            ).toBe(false);
            expect(
                shouldOfferLightningAddressMintSwitch({
                    ...base,
                    lightningAddressType: 'zaplocker'
                })
            ).toBe(false);
        });

        it('does not offer without a new mint', () => {
            expect(
                shouldOfferLightningAddressMintSwitch({
                    ...base,
                    newMintUrl: ''
                })
            ).toBe(false);
        });
    });

    describe('offerLightningAddressMintSwitch', () => {
        const setup = ({
            addressMintUrl = OLD_MINT,
            lightningAddressType = 'cashu',
            setMintUrl = jest.fn().mockResolvedValue({ success: true })
        } = {}) => {
            const lightningAddressStore: any = {
                lightningAddress: 'hal@zeuspay.com',
                lightningAddressType,
                error_msg: '',
                setMintUrl
            };
            const settingsStore: any = {
                settings: { lightningAddress: { mintUrl: addressMintUrl } }
            };
            const cashuStore: any = {
                mintInfos: {
                    [OLD_MINT]: { name: 'Old Mint' },
                    [NEW_MINT]: { name: 'New Mint' }
                }
            };
            return { lightningAddressStore, settingsStore, cashuStore };
        };

        const pressButton = (index: number) =>
            mockAlert.mock.calls[0][2][index].onPress?.();

        it('names both mints and switches the address on confirm', async () => {
            const stores = setup();

            offerLightningAddressMintSwitch({
                ...stores,
                newMintUrl: NEW_MINT
            });

            expect(mockAlert).toHaveBeenCalledTimes(1);
            expect(mockAlert.mock.calls[0][1]).toBe(
                'hal@zeuspay.com: Old Mint -> New Mint'
            );

            pressButton(1);
            await flushPromises();

            expect(
                stores.lightningAddressStore.setMintUrl
            ).toHaveBeenCalledWith(NEW_MINT);
        });

        it('leaves the address alone when the user keeps the current mint', () => {
            const stores = setup();

            offerLightningAddressMintSwitch({
                ...stores,
                newMintUrl: NEW_MINT
            });
            pressButton(0);

            expect(mockAlert.mock.calls[0][2][0].style).toBe('cancel');
            expect(
                stores.lightningAddressStore.setMintUrl
            ).not.toHaveBeenCalled();
        });

        it('falls back to the mint URL when the mint has no name', () => {
            const stores = setup();
            stores.cashuStore.mintInfos = {};

            offerLightningAddressMintSwitch({
                ...stores,
                newMintUrl: NEW_MINT
            });

            expect(mockAlert.mock.calls[0][1]).toBe(
                `hal@zeuspay.com: ${OLD_MINT} -> ${NEW_MINT}`
            );
        });

        it('uses the unknown-mint wording when no mint is stored', () => {
            const stores = setup({ addressMintUrl: '' });

            offerLightningAddressMintSwitch({
                ...stores,
                newMintUrl: NEW_MINT
            });

            expect(mockAlert.mock.calls[0][1]).toBe(
                'hal@zeuspay.com: ? -> New Mint'
            );
        });

        it('shows the store error when ZEUS Pay rejects the switch', async () => {
            const stores = setup({
                setMintUrl: jest.fn().mockRejectedValue('mint not supported')
            });
            stores.lightningAddressStore.error_msg = 'mint not supported';

            offerLightningAddressMintSwitch({
                ...stores,
                newMintUrl: NEW_MINT
            });
            pressButton(1);
            await flushPromises();

            expect(mockAlert).toHaveBeenCalledTimes(2);
            expect(mockAlert.mock.calls[1]).toEqual([
                'general.error',
                'mint not supported'
            ]);
        });

        it('does not prompt when the address already uses the mint', () => {
            const stores = setup();

            offerLightningAddressMintSwitch({
                ...stores,
                newMintUrl: OLD_MINT
            });

            expect(mockAlert).not.toHaveBeenCalled();
        });

        it('does not prompt for an NWC address', () => {
            const stores = setup({ lightningAddressType: 'nwc' });

            offerLightningAddressMintSwitch({
                ...stores,
                newMintUrl: NEW_MINT
            });

            expect(mockAlert).not.toHaveBeenCalled();
        });
    });
});
