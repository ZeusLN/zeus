import { settingsStore } from '../stores/Stores';

const numbersLibrary = 'ΑΒΓΔΕϚΣΤΖΗΘϝϟϡ–◦¤☼ΙΠΧΜ';
const alphabetLibrary = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';

const numbers = numbersLibrary.split('');
const alphabet = alphabetLibrary.split('');

class PrivacyUtils {
    // Stores generated masked values to prevent regeneration on each render
    private memoizedValues: Map<string, string> = new Map();

    sensitiveValue = ({
        input,
        fixedLength,
        numberSet,
        condenseAtLength
    }: {
        input: string | number | Date | undefined;
        fixedLength?: number | null;
        numberSet?: boolean;
        condenseAtLength?: number;
    }) => {
        const { settings } = settingsStore;
        const { privacy } = settings;
        const lurkerMode = (privacy && privacy.lurkerMode) || false;

        // Create unique key for memoization based on input parameters
        const inputString = input?.toString() || '';
        const length = fixedLength || inputString.length;

        let condensedString = input;
        if (condenseAtLength && inputString.length > condenseAtLength) {
            condensedString = `${inputString.slice(
                0,
                condenseAtLength - 3
            )}...`;
        }

        if (!lurkerMode) return condensedString;
        const key = `${condensedString}-${length}-${numberSet}`;

        // Generate and store new masked value only if not already memoized
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
