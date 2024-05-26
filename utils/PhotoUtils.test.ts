import { getPhoto } from './PhotoUtils';
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
                '../../../assets/images/LND.jpg'
            );
            expect(getPhoto('preset://zeusillustration1a')).toEqual(
                '../../../assets/images/zeus-illustration-1a.jpg'
            );
        });

        it('returns value as is if no match', () => {
            expect(getPhoto('file://zeus1.jpg')).toEqual('file://zeus1.jpg');
            expect(getPhoto('file://zeus2.jpg')).toEqual('file://zeus2.jpg');
            expect(getPhoto('file://zeus3.jpg')).toEqual('file://zeus3.jpg');
        });
    });
});
