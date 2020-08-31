import stores from '../stores/Stores';
import * as English from './../locales/en.json';
import * as Czech from './../locales/cs.json';
import * as German from './../locales/de.json';
import * as Spanish from './../locales/es.json';
import * as BrazilianPortuguese from './../locales/pt_BR.json';
import * as Slovak from './../locales/sk.json';
import * as Turkish from './../locales/tr.json';

export function localeString(localeString: string) {
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
        default:
            return English[localeString];
    }
}
