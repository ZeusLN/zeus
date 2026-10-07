import { toCsvRow } from './CsvUtils';

describe('CsvUtils', () => {
    describe('toCsvRow', () => {
        it('quotes every field', () => {
            expect(toCsvRow(['abc', 10800, 'ln'])).toBe('"abc","10800","ln"');
        });

        it('keeps a value containing commas in one field', () => {
            expect(toCsvRow(['$100,000 BTC/USD'])).toBe('"$100,000 BTC/USD"');
        });

        it('doubles quotes inside a field', () => {
            expect(toCsvRow(['say "hi"'])).toBe('"say ""hi"""');
        });

        it('keeps line breaks inside the quoted field', () => {
            expect(toCsvRow(['line 1\nline 2', 'next'])).toBe(
                '"line 1\nline 2","next"'
            );
        });

        it('keeps zero', () => {
            expect(toCsvRow([0, '0'])).toBe('"0","0"');
        });

        it('leaves missing values empty', () => {
            expect(toCsvRow([undefined, null, ''])).toBe('"","",""');
        });
    });
});
