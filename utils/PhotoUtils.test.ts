import { getPhoto, getPresetName } from './PhotoUtils';
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

    describe('getPresetName', () => {
        it('extracts zeus illustration names from dev server URIs', () => {
            expect(
                getPresetName(
                    'http://localhost:8081/assets/assets/images/zeus_illustration_1a.jpg?platform=ios&hash=abc'
                )
            ).toEqual('zeusillustration1a');
            expect(
                getPresetName(
                    'http://localhost:8081/assets/assets/images/zeus_illustration_7b.jpg?platform=android&hash=xyz'
                )
            ).toEqual('zeusillustration7b');
        });

        it('extracts implementation image names from dev server URIs', () => {
            expect(
                getPresetName(
                    'http://localhost:8081/assets/assets/images/alby.jpg?platform=ios&hash=abc'
                )
            ).toEqual('alby');
            expect(
                getPresetName(
                    'http://localhost:8081/assets/assets/images/nostrwalletconnect.jpg?platform=ios&hash=abc'
                )
            ).toEqual('nostrwalletconnect');
            expect(
                getPresetName(
                    'http://localhost:8081/assets/assets/images/ldk.png?platform=ios&hash=abc'
                )
            ).toEqual('ldk');
        });

        it('handles URIs without query params', () => {
            expect(
                getPresetName(
                    'file:///app/assets/images/zeus_illustration_3a.jpg'
                )
            ).toEqual('zeusillustration3a');
            expect(
                getPresetName('file:///app/assets/images/btcpay.jpg')
            ).toEqual('btcpay');
        });

        it('handles all zeus illustration variants', () => {
            for (let i = 1; i <= 7; i++) {
                for (const suffix of ['a', 'b']) {
                    expect(
                        getPresetName(
                            `http://localhost:8081/assets/images/zeus_illustration_${i}${suffix}.jpg?hash=x`
                        )
                    ).toEqual(`zeusillustration${i}${suffix}`);
                }
            }
        });
    });
});
