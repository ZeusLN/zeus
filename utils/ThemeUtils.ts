import stores from '../stores/Stores';

export function themeColor(themeString: string): any {
    const { settings } = stores.settingsStore;
    const { theme } = settings;

    const Light = {
        background: 'white',
        secondary: '#f7f7f7', // '#f0f0f0',
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
    };

    const Dark = {
        background: '#1f2328',
        secondary: '#2b3037',
        text: 'white',
        secondaryText: 'gray',
        highlight: '#ffd24b',
        error: '#992600',
        gradient: ['black', '#1f2328', '#1f2328', '#1f2328'],
        separator: 'darkgray'
    };

    switch (theme) {
        case 'light':
            return Light[themeString] || Dark[themeString];
        default:
            return Dark[themeString];
    }
}
