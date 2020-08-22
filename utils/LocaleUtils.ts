import stores from '../stores/Stores';
import * as English from './../locales/en.json';
import * as Czech from './../locales/cs.json';

export function localeString(localeString: string) {
    const { settings } = stores.settingsStore;
    const { locale } = settings;

    switch (locale) {
        case 'Czech':
            return Czech[localeString] || English[localeString];
        default:
            return English[localeString];
    }
}
