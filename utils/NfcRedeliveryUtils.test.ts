import {
    REDELIVERY_WINDOW_MS,
    isTagRedelivery,
    noteTagSessionEnded
} from './NfcRedeliveryUtils';

describe('NfcRedeliveryUtils', () => {
    const TAG = 'BITCOIN:?LIGHTNING=LNBC210N1XYZ&CREQ=CREQB1QYQQSE';
    let now = 1_000_000;

    beforeEach(() => {
        jest.spyOn(Date, 'now').mockImplementation(() => now);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('recognizes the tag Android delivers again after a session', () => {
        noteTagSessionEnded(TAG);
        now += 1000;

        expect(isTagRedelivery(TAG)).toBe(true);
    });

    it('ignores surrounding whitespace', () => {
        noteTagSessionEnded(`${TAG}\n`);

        expect(isTagRedelivery(` ${TAG}`)).toBe(true);
    });

    it('matches each session once, so tapping the tag again works', () => {
        noteTagSessionEnded(TAG);

        expect(isTagRedelivery(TAG)).toBe(true);
        expect(isTagRedelivery(TAG)).toBe(false);
    });

    it('lets the same tag through after the window', () => {
        noteTagSessionEnded(TAG);
        now += REDELIVERY_WINDOW_MS;

        expect(isTagRedelivery(TAG)).toBe(false);
    });

    it('lets another tag through', () => {
        noteTagSessionEnded(TAG);

        expect(isTagRedelivery('lnurlw://example.com/withdraw')).toBe(false);
        // the session's tag is still recognized
        expect(isTagRedelivery(TAG)).toBe(true);
    });
});
