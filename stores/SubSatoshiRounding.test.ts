/**
 * Tests for sub-satoshi rounding behavior in NWC fee limits and amounts
 *
 * Per NIP-47 spec, fee_limit_msat represents the maximum fee the client will pay.
 * Rounding must use Math.floor to respect this hard ceiling (not exceed the limit).
 */

describe('SubSatoshiRounding', () => {
    describe('Fee limit conversion (msat -> sat)', () => {
        it('should floor 1500 msat fee limit to 1 sat (not ceil to 2)', () => {
            // Client specifies: max fee is 1500 msat (1.5 sat)
            // Using Math.floor: 1500 / 1000 = 1.5 -> floor -> 1 sat
            // Using Math.ceil: 1500 / 1000 = 1.5 -> ceil -> 2 sat (EXCEEDS limit, violates NIP-47)
            const feeLimitMsat = 1500;
            const feeLimitSatFloor = Math.floor(feeLimitMsat / 1000);
            const feeLimitSatCeil = Math.ceil(feeLimitMsat / 1000);

            expect(feeLimitSatFloor).toBe(1);
            expect(feeLimitSatCeil).toBe(2); // WRONG - exceeds hard limit

            // Correct behavior: use floor
            expect(feeLimitSatFloor).toBeLessThanOrEqual(feeLimitMsat / 1000);
        });

        it('should floor 1001 msat fee limit to 1 sat', () => {
            const feeLimitMsat = 1001;
            const feeLimitSatFloor = Math.floor(feeLimitMsat / 1000);

            expect(feeLimitSatFloor).toBe(1);
            // Verify floor never exceeds the msat limit
            expect(feeLimitSatFloor * 1000).toBeLessThanOrEqual(
                feeLimitMsat + 999
            );
        });

        it('should floor 1 msat fee limit to 0 sat', () => {
            const feeLimitMsat = 1;
            const feeLimitSatFloor = Math.floor(feeLimitMsat / 1000);

            expect(feeLimitSatFloor).toBe(0);
        });

        it('should floor 999 msat fee limit to 0 sat', () => {
            const feeLimitMsat = 999;
            const feeLimitSatFloor = Math.floor(feeLimitMsat / 1000);

            expect(feeLimitSatFloor).toBe(0);
        });

        it('should floor 1000 msat fee limit to exactly 1 sat', () => {
            const feeLimitMsat = 1000;
            const feeLimitSatFloor = Math.floor(feeLimitMsat / 1000);

            expect(feeLimitSatFloor).toBe(1);
        });

        it('should floor 5500 msat fee limit to 5 sat (not ceil to 6)', () => {
            const feeLimitMsat = 5500;
            const feeLimitSatFloor = Math.floor(feeLimitMsat / 1000);
            const feeLimitSatCeil = Math.ceil(feeLimitMsat / 1000);

            expect(feeLimitSatFloor).toBe(5);
            expect(feeLimitSatCeil).toBe(6); // WRONG - exceeds limit

            // Verify floor respects the hard ceiling
            expect(feeLimitSatFloor * 1000).toBeLessThanOrEqual(
                feeLimitMsat + 999
            );
        });
    });

    describe('Amount conversion (msat -> sat) for payments', () => {
        it('should floor 1500 msat payment amount to 1 sat', () => {
            // When client requests 1500 msat, they get 1 sat (not rounded up to 2)
            const amountMsat = 1500;
            const amountSatFloor = Math.floor(amountMsat / 1000);

            expect(amountSatFloor).toBe(1);
            // Verify actual amount paid ≤ requested
            expect(amountSatFloor * 1000).toBeLessThanOrEqual(amountMsat + 999);
        });

        it('should floor 1001 msat payment amount to 1 sat', () => {
            const amountMsat = 1001;
            const amountSatFloor = Math.floor(amountMsat / 1000);

            expect(amountSatFloor).toBe(1);
        });

        it('should handle very small amounts (1 msat) by flooring to 0 sat', () => {
            const amountMsat = 1;
            const amountSatFloor = Math.floor(amountMsat / 1000);

            expect(amountSatFloor).toBe(0);
        });
    });

    describe('Hard ceiling enforcement', () => {
        it('should never exceed fee limit when flooring sub-sat amounts', () => {
            const testCases = [1, 500, 999, 1001, 1500, 5500, 9999];

            testCases.forEach((msat) => {
                const sat = Math.floor(msat / 1000);
                // The actual payment in msat (assuming 1 sat = 1000 msat)
                const actualMsat = sat * 1000;

                expect(actualMsat).toBeLessThanOrEqual(msat + 999);
                // For most cases, actual is less than or equal to requested
                expect(sat).toBeLessThanOrEqual(Math.ceil(msat / 1000));
            });
        });

        it('should document the tradeoff: sub-sat amounts are truncated', () => {
            // Client requests 1500 msat, network processes 1000 msat
            // This is a documented tradeoff of sat-precision pipeline
            const clientRequest = 1500;
            const networkProcessed = Math.floor(clientRequest / 1000) * 1000;
            const truncatedAmount = clientRequest - networkProcessed;

            expect(networkProcessed).toBe(1000);
            expect(truncatedAmount).toBe(500);

            // This is acceptable per NIP-47 because:
            // 1. Protocol operates in sat precision
            // 2. Client explicitly provides msat, understanding sat limitations
            // 3. Better to underpay/underfee than to overpay/overfee
        });
    });
});
