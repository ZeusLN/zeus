import { NativeModules } from 'react-native';

// Load JSON files directly using require
const English: any = require('../locales/en.json');
const Czech: any = require('../locales/cs.json');
const German: any = require('../locales/de.json');
const Spanish: any = require('../locales/es.json');
const BrazilianPortuguese: any = require('../locales/pt_BR.json');
const Slovak: any = require('../locales/sk.json');
const Turkish: any = require('../locales/tr.json');
const Persian: any = require('../locales/fa.json');
const Greek: any = require('../locales/el.json');
const Slovenian: any = require('../locales/sl.json');
const Hungarian: any = require('../locales/hu.json');
const SimplifiedChinese: any = require('../locales/zh_CN.json');
const French: any = require('../locales/fr.json');
const Dutch: any = require('../locales/nl.json');
const NorwegianBokmal: any = require('../locales/nb.json');
const Swedish: any = require('../locales/sv.json');
const Thai: any = require('../locales/th.json');
const Ukrainian: any = require('../locales/uk.json');
const Romanian: any = require('../locales/ro.json');
const Polish: any = require('../locales/pl.json');
const Hebrew: any = require('../locales/he.json');
const Croatian: any = require('../locales/hr.json');
const Swahili: any = require('../locales/sw.json');
const Hindi: any = require('../locales/hi_IN.json');
const TraditionalChinese: any = require('../locales/zh_TW.json');
const Russian: any = require('../locales/ru.json');
const Finnish: any = require('../locales/fi.json');
const Italian: any = require('../locales/it.json');
const Vietnamese: any = require('../locales/vi.json');
const Japanese: any = require('../locales/ja.json');
const Korean: any = require('../locales/ko.json');

const JAVA_LAYER_STRINGS = [
    'androidNotification.lndRunningBackground',
    'androidNotification.shutdown'
];

export function localeString(
    localeString: string,
    substitutions?: { [key: string]: string | number }
): any {
    // For now, always use English locale to avoid circular dependency issues
    // This ensures the app can start without crashing
    // TODO: Implement proper locale detection once the circular dependency is resolved
    const locale = 'en';

    let translation: string;
    const getString = () => {
        switch (locale) {
        case 'es':
            return Spanish[localeString] || English[localeString];
        case 'pt':
            return (
                BrazilianPortuguese[localeString] || English[localeString]
            );
        case 'tr':
            return Turkish[localeString] || English[localeString];
        case 'sk':
            return Slovak[localeString] || English[localeString];
        case 'cs':
            return Czech[localeString] || English[localeString];
        case 'de':
            return German[localeString] || English[localeString];
        case 'el':
            return Greek[localeString] || English[localeString];
        case 'nb':
            return NorwegianBokmal[localeString] || English[localeString];
        case 'sv':
            return Swedish[localeString] || English[localeString];
        case 'th':
            return Thai[localeString] || English[localeString];
        case 'uk':
            return Ukrainian[localeString] || English[localeString];
        case 'ro':
            return Romanian[localeString] || English[localeString];
        case 'pl':
            return Polish[localeString] || English[localeString];
        case 'he':
            return Hebrew[localeString] || English[localeString];
        case 'hr':
            return Croatian[localeString] || English[localeString];
        case 'sw':
            return Swahili[localeString] || English[localeString];
        case 'hi':
            return Hindi[localeString] || English[localeString];
        case 'zh-tw':
            return TraditionalChinese[localeString] || English[localeString];
        case 'ru':
            return Russian[localeString] || English[localeString];
        case 'fi':
            return Finnish[localeString] || English[localeString];
        case 'it':
            return Italian[localeString] || English[localeString];
        case 'vi':
            return Vietnamese[localeString] || English[localeString];
        case 'ja':
            return Japanese[localeString] || English[localeString];
        case 'ko':
            return Korean[localeString] || English[localeString];
        case 'fa':
            return Persian[localeString] || English[localeString];
        case 'sl':
            return Slovenian[localeString] || English[localeString];
        case 'hu':
            return Hungarian[localeString] || English[localeString];
        case 'zh-cn':
            return SimplifiedChinese[localeString] || English[localeString];
        case 'fr':
            return French[localeString] || English[localeString];
        case 'nl':
            return Dutch[localeString] || English[localeString];
        default:
            return English[localeString];
        }
    };

    translation = getString();

    if (substitutions && translation) {
        Object.keys(substitutions).forEach((subKey) => {
            const regex = new RegExp(`{{${subKey}}}`, 'g');
            translation = translation.replace(
                regex,
                String(substitutions[subKey])
            );
        });
    }

    return translation;
}

export const languagesWithNounCapitalization = ['de', 'pl', 'cs', 'sk'];

export const formatInlineNoun = (text: string): string => {
    // For now, always use lowercase to avoid circular dependency issues
    // TODO: Implement proper locale detection once the circular dependency is resolved
    return text.toLowerCase();
};

export const bridgeJavaStrings = (locale: string) => {
    const neededTranslations: { [key: string]: string } = {};
    JAVA_LAYER_STRINGS.forEach((key) => {
        neededTranslations[key] = localeString(key);
    });

    if (NativeModules.LndMobile) {
        NativeModules.LndMobile.bridgeStringResources(
            JSON.stringify(neededTranslations)
        );
    }
};
