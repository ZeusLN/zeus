import stores from '../stores/Stores';
import * as EN from './../locales/en.json';
import * as CS from './../locales/cs.json';
import * as DE from './../locales/de.json';
import * as ES from './../locales/es.json';
import * as PTBR from './../locales/pt_BR.json';
import * as SK from './../locales/sk.json';
import * as TR from './../locales/tr.json';
// in progress
import * as FA from './../locales/fa.json';
import * as EL from './../locales/el.json';
import * as FR from './../locales/fr.json';
import * as NL from './../locales/nl.json';

const English: any = EN;
const Czech: any = CS;
const German: any = DE;
const Spanish: any = ES;
const BrazilianPortuguese: any = PTBR;
const Slovak: any = SK;
const Turkish: any = TR;
const Persian: any = FA;
const Greek: any = EL;
const French: any = FR;
const Dutch: any = NL;

export function localeString(localeString: string): any {
    const { settings } = stores.settingsStore;
    const { locale } = settings;

    switch (locale) {
        case 'Español':
            return Spanish[localeString] || English[localeString];
        case 'Português':
            return BrazilianPortuguese[localeString] || English[localeString];
        case 'Türkçe':
            return Turkish[localeString] || English[localeString];
        case 'Slovák':
            return Slovak[localeString] || English[localeString];
        case 'Češka':
            return Czech[localeString] || English[localeString];
        case 'Deutsche':
            return German[localeString] || English[localeString];
        case 'Ελληνικά':
            return Greek[localeString] || English[localeString];
        case 'زبان فارسي':
            return Persian[localeString] || English[localeString];
        case 'Français':
            return French[localeString] || English[localeString];
        case 'Nederlands':
            return Dutch[localeString] || English[localeString];
        default:
            return English[localeString];
    }
}
