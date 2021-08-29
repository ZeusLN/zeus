import stores from '../stores/Stores';

export function themeColor(themeString: string): any {
    const { settings } = stores.settingsStore;
    const { theme } = settings;

    const Light: { [key: string]: any } = {
        background: 'white',
        secondary: '#f0f0f0',
        text: 'black',
        secondaryText: '#8a8999',
        highlight: 'orange',
        error: '#cc3300',
        gradient: [
            'white',
            'white',
            'white',
            'white',
            'white',
            'lightgrey',
            'grey',
            'grey'
        ],
        separator: '#CED0CE'
        // TODO: pick outbound and inbound colors for light and junkie themes
        // TODO: success / warning / bitcoin colors for light and junkie (are they just the same?)
    };

    const Dark: { [key: string]: any } = {
        background: '#1f2328',
        secondary: '#2b3037',
        text: 'white',
        secondaryText: '#A7A9AC',
        highlight: '#ffd24b',
        error: '#992600',
        gradient: ['black', '#1f2328', '#1f2328', '#1f2328'],
        separator: '#31363F',
        outbound: '#FFD93F',
        inbound: '#FFF0CA',
        success: '#46BE43',
        warning: '#E14C4C',
        bitcoin: '#FFB040'
    };

    const Junkie: { [key: string]: any } = {
        background: 'rgb(51, 51, 51)',
        secondary: 'rgb(191, 0, 28)',
        text: 'white',
        secondaryText: 'lightgray',
        highlight: 'rgb(249, 212, 0)',
        error: '#992600',
        gradient: [
            'black',
            'rgb(51, 51, 51)',
            'rgb(51, 51, 51)',
            'rgb(51, 51, 51)'
        ],
        separator: 'darkgray',
        outbound: '#FFD93F',
        inbound: '#FFF0CA'
    };

    switch (theme) {
        case 'light':
            return Light[themeString] || Dark[themeString];
        case 'junkie':
            return Junkie[themeString] || Dark[themeString];
        default:
            return Dark[themeString];
    }
}
