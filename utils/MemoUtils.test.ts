import { decodeMemo, withReceiverName } from './MemoUtils';

describe('MemoUtils.decodeMemo', () => {
    it('decodes percent-encoded spaces (#1717)', () => {
        expect(decodeMemo('Pay%20to%20Alice')).toBe('Pay to Alice');
    });

    it('decodes other percent-encoded characters', () => {
        expect(decodeMemo('caf%C3%A9%20%26%20bar')).toBe('café & bar');
        expect(decodeMemo('100%25 legit')).toBe('100% legit');
    });

    it('leaves plain memos untouched', () => {
        expect(decodeMemo('Pay to Alice')).toBe('Pay to Alice');
        expect(decodeMemo('zeus pay: tip')).toBe('zeus pay: tip');
    });

    it('leaves memos with a bare % untouched', () => {
        expect(decodeMemo('50% off')).toBe('50% off');
        expect(decodeMemo('100%')).toBe('100%');
    });

    it('returns the original when decoding throws despite a valid-looking sequence', () => {
        // %20 matches, but the bare "% o" makes decodeURIComponent throw
        expect(decodeMemo('50% off%20today')).toBe('50% off%20today');
        // %ff matches the pattern but is an invalid lone UTF-8 byte
        expect(decodeMemo('bad%ffbyte')).toBe('bad%ffbyte');
    });

    it('does not treat + as a space', () => {
        expect(decodeMemo('1+1%202')).toBe('1+1 2');
    });

    it('passes through empty and undefined values', () => {
        expect(decodeMemo('')).toBe('');
        expect(decodeMemo(undefined)).toBeUndefined();
    });
});

describe('MemoUtils.withReceiverName', () => {
    it('joins the receiver name and memo', () => {
        expect(withReceiverName('Shop', 'Coffee')).toBe('Shop:  Coffee');
    });

    it('is the receiver name alone when there is no memo', () => {
        expect(withReceiverName('Shop', '')).toBe('Shop');
        expect(withReceiverName('Shop', undefined)).toBe('Shop');
    });

    it('is the memo alone when there is no receiver name', () => {
        expect(withReceiverName('', 'Coffee')).toBe('Coffee');
        expect(withReceiverName(undefined, 'Coffee')).toBe('Coffee');
    });

    it('is empty when there is neither', () => {
        expect(withReceiverName('', '')).toBe('');
        expect(withReceiverName(undefined, undefined)).toBe('');
    });
});
