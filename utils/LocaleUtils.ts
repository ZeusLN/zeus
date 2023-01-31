import stores from '../stores/Stores';
import * as EN from './../locales/en.json';
import * as CS from './../locales/cs.json';
import * as DE from './../locales/de.json';
import * as ES from './../locales/es.json';
import * as PTBR from './../locales/pt_BR.json';
import * as SK from './../locales/sk.json';
import * as TR from './../locales/tr.json';
import * as HU from './../locales/hu.json';
import * as ZHCN from './../locales/zh_CN.json';
import * as FR from './../locales/fr.json';
import * as NL from './../locales/nl.json';

import * as NB from './../locales/nb.json';
import * as SV from './../locales/sv.json';
import * as TH from './../locales/th.json';
import * as UK from './../locales/uk.json';
import * as RO from './../locales/ro.json';
import * as PL from './../locales/pl.json';

import * as HE from './../locales/he.json';
import * as HR from './../locales/hr.json';

// in progress
import * as FA from './../locales/fa.json';
import * as EL from './../locales/el.json';
import * as SL from './../locales/sl.json';
import * as RU from './../locales/ru.json';
import * as FI from './../locales/fi.json';
import * as IT from './../locales/it.json';
import * as VI from './../locales/vi.json';
import * as JA from './../locales/ja.json';

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
const Hungarian: any = HU;
const SimplifiedChinese: any = ZHCN;

const NorwegianBokmal: any = NB;
const Swedish: any = SV;
const Thai: any = TH;
const Ukranian: any = UK;
const Romanian: any = RO;
const Polish: any = PL;
const Slovenian: any = SL;
const Russian: any = RU;
const Finnish: any = FI;
const Italian: any = IT;
const Vietnamese: any = VI;
const Japanese: any = JA;
const Hebrew: any = HE;
const Croatian: any = HR;

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
        case 'Slovenčina':
            return Slovak[localeString] || English[localeString];
        case 'Čeština':
            return Czech[localeString] || English[localeString];
        case 'Deutsch':
            return German[localeString] || English[localeString];
        case 'Ελληνικά':
            return Greek[localeString] || English[localeString];
        case 'Bokmål':
            return NorwegianBokmal[localeString] || English[localeString];
        case 'Svenska':
            return Swedish[localeString] || English[localeString];
        case 'ภาษาไทย':
            return Thai[localeString] || English[localeString];
        case 'украї́нська мо́ва':
            return Ukranian[localeString] || English[localeString];
        case 'Limba română':
            return Romanian[localeString] || English[localeString];
        case 'Polski':
            return Polish[localeString] || English[localeString];
        case 'زبان فارسي':
            return Persian[localeString] || English[localeString];
        case 'Français':
            return French[localeString] || English[localeString];
        case 'Nederlands':
            return Dutch[localeString] || English[localeString];
        case 'Magyar nyelv':
            return Hungarian[localeString] || English[localeString];
        case '简化字':
            return SimplifiedChinese[localeString] || English[localeString];
        case 'Slovenski jezik':
            return Slovenian[localeString] || English[localeString];
        case 'русский язык':
            return Russian[localeString] || English[localeString];
        case 'Suomen kieli':
            return Finnish[localeString] || English[localeString];
        case 'Italiano':
            return Italian[localeString] || English[localeString];
        case 'Tiếng Việt':
            return Vietnamese[localeString] || English[localeString];
        case '日本語':
            return Japanese[localeString] || English[localeString];
        case 'עִבְרִית':
            return Hebrew[localeString] || English[localeString];
        case 'Hrvatski':
            return Croatian[localeString] || English[localeString];
        default:
            return English[localeString];
    }
}
