import { getPhoto, getPresetImage, getPresetNames } from './PhotoUtils';
jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: 'docpath'
}));
jest.mock('react-native', () => ({
    Image: {
        resolveAssetSource: (file: any) => ({
            uri: file.testUri
        })
    }
}));

describe('PhotoUtils', () => {
    describe('getPhoto', () => {
        it('groks out rnfs:// values', () => {
            expect(getPhoto('rnfs://zeus1.jpg')).toEqual(
                'file://docpath/zeus1.jpg'
            );
            expect(getPhoto('rnfs://zeus2.jpg')).toEqual(
                'file://docpath/zeus2.jpg'
            );
            expect(getPhoto('rnfs://zeus3.jpg')).toEqual(
                'file://docpath/zeus3.jpg'
            );
        });

        it('groks out preset:// values', () => {
            expect(getPhoto('preset://lnd')).toEqual(
                '../../../assets/images/lnd.jpg'
            );
            expect(getPhoto('preset://zeusillustration1a')).toEqual(
                '../../../assets/images/zeus_illustration_1a.jpg'
            );
        });

        it('returns value as is if no match', () => {
            expect(getPhoto('file://zeus1.jpg')).toEqual('file://zeus1.jpg');
            expect(getPhoto('file://zeus2.jpg')).toEqual('file://zeus2.jpg');
            expect(getPhoto('file://zeus3.jpg')).toEqual('file://zeus3.jpg');
        });
    });

    describe('getPresetNames', () => {
        it('lists the zeus illustrations for every implementation', () => {
            const names = getPresetNames();
            expect(names).toHaveLength(14);
            expect(names[0]).toEqual('zeusillustration1a');
            expect(names[13]).toEqual('zeusillustration7b');
        });

        it('appends implementation specific presets', () => {
            expect(getPresetNames('embedded-lnd').slice(14)).toEqual(['lnd']);
            expect(getPresetNames('cln-rest').slice(14)).toEqual([
                'cln',
                'btcpay'
            ]);
            expect(getPresetNames('unknown')).toHaveLength(14);
        });

        it('only returns names that getPhoto can resolve', () => {
            const implementations = [
                undefined,
                'lndhub',
                'nostr-wallet-connect',
                'lnd',
                'embedded-lnd',
                'lightning-node-connect',
                'cln-rest',
                'ldk-node'
            ];
            for (const implementation of implementations) {
                for (const name of getPresetNames(implementation)) {
                    expect(getPresetImage(name)).toBeDefined();
                    expect(getPhoto(`preset://${name}`)).not.toEqual('');
                }
            }
        });
    });

    describe('legacy preset values', () => {
        it('resolves names saved by Android release builds', () => {
            // v13.0.0 - v13.2.x derived these from Android resource ids
            expect(getPhoto('preset://assetsimageslnd')).toEqual(
                '../../../assets/images/lnd.jpg'
            );
            expect(getPhoto('preset://assetsimageszeusillustration1a')).toEqual(
                '../../../assets/images/zeus_illustration_1a.jpg'
            );
        });

        it('returns an empty string for unknown presets', () => {
            expect(getPhoto('preset://doesnotexist')).toEqual('');
            expect(getPhoto('preset://assetsimagesdoesnotexist')).toEqual('');
        });
    });
});
