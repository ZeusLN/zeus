import stores from '../stores/Stores';

export function themeColor(themeString: string): any {
    const { settings } = stores.settingsStore;
    const { theme } = settings;

    const Light = {
        background: 'white',
        secondary: '#f7f7f7', // '#f0f0f0',
        text: 'black',
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
        ]
    };

    const Dark = {
        background: '#1f2328',
        secondary: '#2b3037',
        text: 'white',
        highlight: '#ffd24b',
        error: '#992600',
        gradient: ['black', '#1f2328', '#1f2328', '#1f2328']
    };

    switch (theme) {
        case 'light':
            return Light[themeString] || Dark[themeString];
        default:
            return Dark[themeString];
    }
}
