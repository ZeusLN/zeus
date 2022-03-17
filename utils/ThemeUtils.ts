import stores from '../stores/Stores';

export function themeColor(themeString: string): any {
    const { settings } = stores.settingsStore;
    const { theme } = settings;

    const Light: { [key: string]: any } = {
        generalStyle: 'light',
        background: '#fff',
        secondary: '#f0f0f0',
        text: 'black',
        secondaryText: '#8a8999',
        highlight: 'orange',
        error: '#cc3300',
        separator: '#CED0CE',
        outbound: '#FFD93F',
        inbound: '#FFF0CA',
        success: '#46BE43',
        warning: '#E14C4C',
        bitcoin: '#FFB040'
        // TODO: pick outbound and inbound colors for light and junkie themes
        // TODO: success / warning / bitcoin colors for light and junkie (are they just the same?)
    };

    const Dark: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#1F242D',
        secondary: '#31363F',
        text: 'white',
        secondaryText: '#A7A9AC',
        highlight: '#ffd24b',
        error: '#992600',
        separator: '#31363F',
        outbound: '#FFD93F',
        inbound: '#FFF0CA',
        success: '#46BE43',
        warning: '#E14C4C',
        bitcoin: '#FFB040'
    };

    const Junkie: { [key: string]: any } = {
        generalStyle: 'dark',
        background: 'rgb(51, 51, 51)',
        secondary: 'rgb(191, 0, 28)',
        text: 'white',
        secondaryText: 'lightgray',
        highlight: 'rgb(249, 212, 0)',
        error: '#992600',
        separator: 'darkgray',
        outbound: '#FFD93F',
        inbound: '#FFF0CA'
    };

    const BPM: { [key: string]: any } = {
        generalStyle: 'light',
        background: '#fff',
        secondary: '#f0f0f0',
        text: '#2b74b4',
        secondaryText: '#8a8999',
        highlight: '#2b74b4',
        error: '#cc3300',
        separator: '#CED0CE'
    };

    const Orange: { [key: string]: any } = {
        generalStyle: 'light',
        background: 'orange',
        secondary: 'darkorange',
        text: 'white',
        secondaryText: 'lightgray',
        highlight: 'black',
        error: '#cc3300',
        separator: '#CED0CE'
    };

    switch (theme) {
        case 'light':
            return Light[themeString] || Dark[themeString];
        case 'junkie':
            return Junkie[themeString] || Dark[themeString];
        case 'bpm':
            return BPM[themeString] || Light[themeString];
        case 'orange':
            return Orange[themeString] || Light[themeString];
        default:
            return Dark[themeString];
    }
}
