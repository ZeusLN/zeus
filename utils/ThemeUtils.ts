import stores from '../stores/Stores';

export function themeColor(themeString: string): any {
    const { settings } = stores.settingsStore;
    const theme = settings.display && settings.display.theme;

    const Kyriaki: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#1E2022',
        secondary: '#31363F',
        text: 'white',
        secondaryText: '#A7A9AC',
        highlight: '#FFA900',
        error: '#992600',
        separator: '#31363F',
        outbound: '#FFA900',
        inbound: '#FFF0CA',
        success: '#46BE43',
        warning: '#E14C4C',
        bitcoin: '#FFB040',
        delete: '#992600',
        qrFrame: '#FFD93F',
        bolt: '#FFF',
        chain: '#FFF',
        disabled: '#767577',
        buttonBackground: '#FFA900',
        buttonGradient: ['#FF9000', '#FFA900'],
        buttonText: '#000000',
        qr: '#FFA900',
        action: '#FFF'
    };

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
        bitcoin: '#FFB040',
        delete: '#cc3300',
        qrFrame: '#FFD93F',
        bolt: '#FFD93F',
        chain: '#FFD93F',
        disabled: '#767577'
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
        bitcoin: '#FFB040',
        delete: '#992600',
        qrFrame: '#FFD93F',
        bolt: '#FFD93F',
        chain: '#FFD93F',
        disabled: '#767577'
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
        inbound: '#FFF0CA',
        delete: '#FFD699'
    };

    const BPM: { [key: string]: any } = {
        generalStyle: 'light',
        background: '#fff',
        secondary: '#f0f0f0',
        text: '#2b74b4',
        secondaryText: '#8a8999',
        highlight: 'orange',
        error: '#cc3300',
        separator: '#CED0CE',
        bolt: '#2b74b4',
        chain: '#2b74b4',
        inbound: 'lightblue',
        outbound: '#2b74b4'
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

    const BlackedOut: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#000',
        secondary: '#141414',
        separator: '#141414'
    };

    const Scarlet: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#56042c',
        secondary: '#8A1538',
        separator: '#8A1538',
        highlight: '#ffd24b'
    };

    const Purple: { [key: string]: any } = {
        generalStyle: 'light',
        background: '#dbd0e1',
        secondary: '#ba9cbf',
        text: '#776d86',
        secondaryText: '#6f7286',
        highlight: '#ffd24b',
        error: '#C9592D',
        separator: '##9fa3bf',
        outbound: '#FFD93F',
        inbound: '#FFF0CA',
        success: '#46BE43',
        warning: '#E14C4C',
        bitcoin: '#FFB040'
    };

    const Blueberry: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#04235A',
        secondary: '#064490',
        separator: '#064490',
        highlight: '#ffd24b'
    };

    const DeepPurple: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#0a0612',
        secondary: '#150c25',
        separator: '#150c25',
        highlight: '#ffd24b'
    };

    const Deadpool: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#000',
        secondary: '#D12531',
        text: '#F4F9FF',
        secondaryText: '#F4F9FF',
        highlight: '#ffd24b',
        error: '#D12531',
        separator: '#D12531',
        outbound: '#D12531',
        inbound: '#838996',
        success: '#46BE43',
        //warning: '#FFD699',
        //bitcoin: '#D12531'
        delete: '#FFD699',
        qrFrame: '#D12531',
        bolt: '#F4F9FF',
        chain: '#F4F9FF'
    };

    const Mighty: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#472243',
        secondary: '#006a65',
        separator: '#006a65',
        highlight: '#fdb827',
        bolt: '#fdb827',
        chain: '#fdb827'
    };

    const Green: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#00793f',
        text: '#fff',
        secondary: '#204c39',
        separator: '#204c39',
        highlight: '#ffd24b',
        bolt: '#fff',
        chain: '#fff'
    };

    const Pub: { [key: string]: any } = {
        generalStyle: 'dark',
        background: '#4C09F4',
        secondary: '#141414',
        separator: '#141414',
        highlight: '#ffd24b',
        bolt: '#fff',
        chain: '#fff'
    };

    const Popsicle: { [key: string]: any } = {
        gradientBackground: ['#FF5C98', '#FF9C23'],
        generalStyle: 'dark',
        background: '#FF9C23',
        separator: '#141414',
        bolt: '#fff',
        chain: '#fff',
        secondaryText: 'lightgray'
    };

    const Nostrich: { [key: string]: any } = {
        gradientBackground: [
            '#000',
            '#1B1B1B',
            '#2A1E36',
            '#3A2152',
            '#49236D',
            '#582688'
        ],
        generalStyle: 'dark',
        background: '#582688',
        secondary: '#141414',
        separator: '#141414'
    };

    const Desert: { [key: string]: any } = {
        gradientBackground: ['#006BB6', '#BEC0C2', '#F58426', '#000000'],
        generalStyle: 'dark',
        background: '#000',
        secondary: '#141414',
        separator: '#141414'
    };

    const OrangeCreamSoda: { [key: string]: any } = {
        gradientBackground: [
            '#FDB777',
            '#FDA766',
            '#FD9346',
            '#FD7F2C',
            '#FF6200'
        ],
        generalStyle: 'dark',
        background: '#FF6200',
        secondary: '#141414',
        separator: '#141414',
        secondaryText: '#E6E6E6'
    };

    const Mint: { [key: string]: any } = {
        gradientBackground: [
            '#ADF0D3',
            '#98E4C4',
            '#84D8B6',
            '#6FCCA7',
            '#5BC099',
            '#46B48A'
        ],
        generalStyle: 'dark',
        background: '#46B48A',
        secondaryText: '#FFFDF2',
        separator: '#141414',
        highlight: '#fff',
        bolt: '#fff',
        chain: '#fff'
    };

    const RedMetallic: { [key: string]: any } = {
        gradientBackground: ['#961E1E', '#A72F2F', '#B94A4A'],
        generalStyle: 'dark',
        background: '#B94A4A',
        secondary: '#141414',
        separator: '#141414'
    };

    const Watermelon: { [key: string]: any } = {
        gradientBackground: ['#FF5C98', 'green'],
        generalStyle: 'dark',
        background: 'green',
        separator: '#141414',
        highlight: '#fff',
        bolt: '#fff',
        chain: '#fff',
        secondaryText: 'lightgray'
    };

    switch (theme) {
        case 'kyriaki':
            return Kyriaki[themeString] || Dark[themeString];
        case 'light':
            return Light[themeString] || Dark[themeString];
        case 'junkie':
            return Junkie[themeString] || Dark[themeString];
        case 'bpm':
            return BPM[themeString] || Light[themeString];
        case 'orange':
            return Orange[themeString] || Light[themeString];
        case 'blacked-out':
            return BlackedOut[themeString] || Dark[themeString];
        case 'scarlet':
            return Scarlet[themeString] || Dark[themeString];
        case 'purple':
            return Purple[themeString] || Light[themeString];
        case 'blueberry':
            return Blueberry[themeString] || Dark[themeString];
        case 'deep-purple':
            return DeepPurple[themeString] || Dark[themeString];
        case 'deadpool':
            return Deadpool[themeString] || Dark[themeString];
        case 'mighty':
            return Mighty[themeString] || Dark[themeString];
        case 'green':
            return Green[themeString] || Dark[themeString];
        case 'pub':
            return Pub[themeString] || Dark[themeString];
        case 'popsicle':
            return Popsicle[themeString] || Dark[themeString];
        case 'nostrich':
            return Nostrich[themeString] || Dark[themeString];
        case 'desert':
            return Desert[themeString] || Dark[themeString];
        case 'orange-cream-soda':
            return OrangeCreamSoda[themeString] || Dark[themeString];
        case 'mint':
            return Mint[themeString] || Dark[themeString];
        case 'red-metallic':
            return RedMetallic[themeString] || Dark[themeString];
        case 'watermelon':
            return Watermelon[themeString] || Dark[themeString];
        default:
            return Dark[themeString];
    }
}
