import stores from '../stores/Stores';

const numbersLibrary = 'ΑΒΓΔΕϚΣΤΖΗΘϝϟϡ–◦¤☼ΙΠΧΜ';
const alphabetLibrary = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';

const numbers = numbersLibrary.split('');
const alphabet = alphabetLibrary.split('');

class PrivacyUtils {
    private memoizedValues: Map<string, string> = new Map();

    sensitiveValue = (
        input: string | number | Date | undefined,
        fixedLength?: number | null,
        numberSet?: boolean
    ) => {
        const { settings } = stores.settingsStore;
        const { privacy } = settings;
        const lurkerMode = (privacy && privacy.lurkerMode) || false;
        if (!lurkerMode) return input;

        const length = fixedLength || (input && input.toString().length) || 1;
        const key = `${input}-${length}-${numberSet}`;

        if (!this.memoizedValues.has(key)) {
            let output = '';
            const wordlist = numberSet ? numbers : alphabet;

            for (let i = 0; i <= length - 1; i++) {
                const newLetter =
                    wordlist[Math.floor(Math.random() * wordlist.length)];
                output = output.concat(newLetter);
            }
            this.memoizedValues.set(key, output);
        }

        return this.memoizedValues.get(key);
    };
}

const privacyUtils = new PrivacyUtils();
export default privacyUtils;
