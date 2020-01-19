const numbersLibrary = 'ΑΒΓΔΕϚΣΤΖΗΘϝϟϡ–◦¤☼ΙΠΧΜ';
const alphabetLibrary = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';

const numbers = numbersLibrary.split('');
const alphabet = alphabetLibrary.split('');

const zeusAffairs = [
    'Antiope',
    'Callisto',
    'Danae',
    'Europa',
    'Leda',
    'Leto',
    'Taygete',
    'Niobe',
    'Io',
    'Semele',
    'Themis',
    'Mnemosyne',
    'Demeter',
    'Alcmene',
    'Persephone',
    'Ganymede',
    'Nemesis',
    'Thaleia'
];

class PrivacyUtils {
    hideValue = (
        input: string | number,
        fixedLength?: number | null,
        numberSet?: boolean
    ) => {
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

    getLover = () => {
        const zeusLovers = [
            'Hera',
            zeusAffairs[Math.floor(Math.random() * zeusAffairs.length)]
        ];

        return zeusLovers[Math.floor(Math.random() * zeusLovers.length)];
    };
}

const privacyUtils = new PrivacyUtils();
export default privacyUtils;
