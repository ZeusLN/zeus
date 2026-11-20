import { font } from './FontUtils';

describe('FontUtils', () => {
    it('returns Gloock for the headline font', () => {
        expect(font('headline')).toBe('Gloock-Regular');
    });

    it('no longer has the Marlide Display keys', () => {
        expect(font('marlide')).toBeUndefined();
        expect(font('marlideBold')).toBeUndefined();
    });
});
