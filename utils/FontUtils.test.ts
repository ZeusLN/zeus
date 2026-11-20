const load = (os: string) => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    return require('./FontUtils');
};

describe('FontUtils', () => {
    afterEach(() => {
        jest.dontMock('react-native');
    });

    it('returns the Marlide Display Bold file name on Android', () => {
        expect(load('android').font('marlideBold')).toBe(
            'Marlide-Display-Bold'
        );
    });

    it('returns the Marlide Display Bold PostScript name on iOS', () => {
        expect(load('ios').font('marlideBold')).toBe('MarlideDisplay_Bold');
    });

    it('no longer has a Marlide Display Regular key', () => {
        expect(load('android').font('marlide')).toBeUndefined();
        expect(load('ios').font('marlide')).toBeUndefined();
    });
});
