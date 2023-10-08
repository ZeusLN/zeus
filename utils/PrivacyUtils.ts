import stores from '../stores/Stores';

const numbersLibrary = 'ΑΒΓΔΕϚΣΤΖΗΘϝϟϡ–◦¤☼ΙΠΧΜ';
const alphabetLibrary = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';

const numbers = numbersLibrary.split('');
const alphabet = alphabetLibrary.split('');

class PrivacyUtils {
    sensitiveValue = (
        input: string | number | Date | undefined,
        fixedLength?: number | null,
        numberSet?: boolean
    ) => {
        const { privacy } = stores.settingsStore.settings;
        const lurkerMode = (privacy && privacy.lurkerMode) || false;
        if (!lurkerMode) return input;

        let output = '';
        const length = fixedLength || (input && input.toString().length) || 1;
        const wordlist = numberSet ? numbers : alphabet;

        for (let i = 0; i <= length - 1; i++) {
            const newLetter =
                wordlist[Math.floor(Math.random() * wordlist.length)];
            output = output.concat(newLetter);
        }
        return output;
    };
}

const privacyUtils = new PrivacyUtils();
export default privacyUtils;
