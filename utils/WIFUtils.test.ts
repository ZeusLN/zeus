import wifUtils from './WIFUtils';

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));

describe('WIFUtils', () => {
    describe('validateWIF', () => {
        it('validates correct WIFs', () => {
            // WIF (mainnet)
            expect(
                wifUtils.validateWIF(
                    'KzbXVJSMscR5AQT4yhPfofUmtu17cqZKNs7jfRxrjXx5cpA8Aqyf'
                )
            ).toEqual({ isValid: true });
            expect(
                wifUtils.validateWIF(
                    '5KjYaip8wQ3AazDVso1sEqhcvudvK6oykuEr5fYbPoX4MKjcVKe'
                )
            ).toEqual({ isValid: true });
            expect(
                wifUtils.validateWIF(
                    'L1b5e8hMpa31jFvopTh76iYiKqLt56LkNuXE1X9aX8RhuFTRfPsD'
                )
            ).toEqual({ isValid: true });

            // WIF (testnet)
            expect(
                wifUtils.validateWIF(
                    'cNdGLyNdGCXGoM8Vg5RM7LApKZTdGCRvrqT8EJHYXr3eMqsKP3NC'
                )
            ).toEqual({ isValid: true });
            expect(
                wifUtils.validateWIF(
                    '91pe1SuvyuudCrsdrdoJF84aqAAf84x3EZGtUwDMjnYs9tPo4Ge'
                )
            ).toEqual({ isValid: true });
        });

        it('rejects WIFs with invalid prefix', () => {
            const result = wifUtils.validateWIF(
                'A123456789012345678901234567890123456789012345678901'
            );
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('rejects WIFs with invalid length', () => {
            const result = wifUtils.validateWIF(
                'Kx45GeUBSMPReYQ7Z5Jd2rj5rV5gkq7y6r1d1zQw5pA1Yb1Q9'
            );
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('rejects WIFs with invalid base58 chars', () => {
            const result = wifUtils.validateWIF(
                'Kx45GeUBSMPReYQ7Z5Jd2rj5rV5gkq7y6r1d1zQw5pA1Yb1Q9b4O'
            ); // 'O' is not in base58
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('rejects WIFs with invalid decoded length', () => {
            const result = wifUtils.validateWIF(
                'Kx45GeUBSMPReYQ7Z5Jd2rj5rV5gkq7y6r1d1zQw5pA1Yb1Q9b4'
            );
            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});
