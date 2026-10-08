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

        it.each(['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\t=1', '\r=1'])(
            'prefixes text a spreadsheet would run as a formula: %j',
            (value) => {
                expect(toCsvRow([value])).toBe(`"'${value}"`);
            }
        );

        it('escapes quotes after prefixing a formula', () => {
            expect(toCsvRow(['=HYPERLINK("http://x","pay")'])).toBe(
                '"\'=HYPERLINK(""http://x"",""pay"")"'
            );
        });

        it('leaves negative and signed numbers alone', () => {
            expect(toCsvRow(['-2000', -2000, '-0.5', '+21'])).toBe(
                '"-2000","-2000","-0.5","+21"'
            );
        });

        it.each(['-Infinity', '\t1', '-1 '])(
            'prefixes a trigger value that is not a plain number: %j',
            (value) => {
                expect(toCsvRow([value])).toBe(`"'${value}"`);
            }
        );

        it.each([' =1', '  @SUM(A1)', '\n=1', ' \t-1+1'])(
            'prefixes a formula after leading whitespace: %j',
            (value) => {
                expect(toCsvRow([value])).toBe(`"'${value}"`);
            }
        );

        it('leaves text with leading whitespace but no trigger alone', () => {
            expect(toCsvRow([' coffee', '\nnote'])).toBe('" coffee","\nnote"');
        });

        it('leaves a trigger character later in the text alone', () => {
            expect(toCsvRow(['a=b', 'coffee @ 3pm'])).toBe(
                '"a=b","coffee @ 3pm"'
            );
        });
    });
});
