import { Image } from 'react-native';
import RNFS from 'react-native-fs';

// Preset wallet pictures, keyed by the name stored as `preset://<name>`.
// The keys are persisted in node configs, so they must never change.
const PRESET_IMAGES: { [name: string]: any } = {
    zeusillustration1a: require('../assets/images/zeus_illustration_1a.jpg'),
    zeusillustration1b: require('../assets/images/zeus_illustration_1b.jpg'),
    zeusillustration2a: require('../assets/images/zeus_illustration_2a.jpg'),
    zeusillustration2b: require('../assets/images/zeus_illustration_2b.jpg'),
    zeusillustration3a: require('../assets/images/zeus_illustration_3a.jpg'),
    zeusillustration3b: require('../assets/images/zeus_illustration_3b.jpg'),
    zeusillustration4a: require('../assets/images/zeus_illustration_4a.jpg'),
    zeusillustration4b: require('../assets/images/zeus_illustration_4b.jpg'),
    zeusillustration5a: require('../assets/images/zeus_illustration_5a.jpg'),
    zeusillustration5b: require('../assets/images/zeus_illustration_5b.jpg'),
    zeusillustration6a: require('../assets/images/zeus_illustration_6a.jpg'),
    zeusillustration6b: require('../assets/images/zeus_illustration_6b.jpg'),
    zeusillustration7a: require('../assets/images/zeus_illustration_7a.jpg'),
    zeusillustration7b: require('../assets/images/zeus_illustration_7b.jpg'),

    alby: require('../assets/images/alby.jpg'),
    albyhub: require('../assets/images/albyhub.jpg'),
    btcpay: require('../assets/images/btcpay.jpg'),
    cashu: require('../assets/images/cashu.jpg'),
    cln: require('../assets/images/cln.jpg'),
    lnd: require('../assets/images/lnd.jpg'),
    nostr: require('../assets/images/nostr.jpg'),
    nostrwalletconnect: require('../assets/images/nostrwalletconnect.jpg'),
    ldk: require('../assets/images/ldk.png')
};

const ZEUS_ILLUSTRATION_PRESETS = Object.keys(PRESET_IMAGES).filter((name) =>
    name.startsWith('zeusillustration')
);

const IMPLEMENTATION_PRESETS: { [implementation: string]: string[] } = {
    lndhub: ['alby'],
    'nostr-wallet-connect': [
        'alby',
        'albyhub',
        'cashu',
        'nostr',
        'nostrwalletconnect'
    ],
    lnd: ['btcpay', 'lnd'],
    'embedded-lnd': ['lnd'],
    'lightning-node-connect': ['lnd'],
    'cln-rest': ['cln', 'btcpay'],
    'ldk-node': ['ldk']
};

const getPresetNames = (implementation?: string): string[] => [
    ...ZEUS_ILLUSTRATION_PRESETS,
    ...((implementation && IMPLEMENTATION_PRESETS[implementation]) || [])
];

const getPresetImage = (name: string): any => PRESET_IMAGES[name];

// v13.0.0 - v13.2.x Android release builds derived preset names from
// Android resource identifiers (e.g. `assets_images_lnd`), so saved values
// look like `preset://assetsimageslnd`. Strip that prefix so they render.
const LEGACY_ANDROID_PREFIX = 'assetsimages';

const getPhoto = (photo: string | undefined): string => {
    if (typeof photo === 'string' && photo.includes('rnfs://')) {
        const fileName = photo.replace('rnfs://', '');
        return `file://${RNFS.DocumentDirectoryPath}/${fileName}`;
    }
    if (typeof photo === 'string' && photo.includes('preset://')) {
        let name = photo.replace('preset://', '');
        if (!PRESET_IMAGES[name] && name.startsWith(LEGACY_ANDROID_PREFIX)) {
            name = name.slice(LEGACY_ANDROID_PREFIX.length);
        }
        const file = PRESET_IMAGES[name];
        return (file && Image.resolveAssetSource(file)?.uri) || '';
    }
    return photo || '';
};

export { getPhoto, getPresetNames, getPresetImage };
