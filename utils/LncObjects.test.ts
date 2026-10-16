// The app loads the prebuilt bundle (package.json "main"), so test it
// alongside the TypeScript source it was built from. require() keeps tsc
// from type-checking the vendored source, which zeus_modules excludes.
const libObjects = require('../zeus_modules/@lightninglabs/lnc-core/lib/util/objects');
const distObjects = require('../zeus_modules/@lightninglabs/lnc-core/dist/index.js');

describe.each([
    ['lib', libObjects],
    ['dist', distObjects]
])('lnc-core objects (%s)', (_, { camelKeysToSnake, snakeKeysToCamel }) => {
    describe('camelKeysToSnake', () => {
        it('converts nested keys', () => {
            expect(
                camelKeysToSnake({
                    someKey: 1,
                    nestedList: [{ innerKey: 'a' }]
                })
            ).toEqual({ some_key: 1, nested_list: [{ inner_key: 'a' }] });
        });

        describe.each(['__proto__', '_Proto__'])('with the key %s', (key) => {
            const malicious = () =>
                JSON.parse(`{"userName":"guest","${key}":{"isAdmin":true}}`);

            it('keeps __proto__ as an own property', () => {
                const result: any = camelKeysToSnake(malicious());

                expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
                expect(result.user_name).toBe('guest');
                expect(result.is_admin).toBeUndefined();
                expect(Object.keys(result)).toEqual(['user_name', '__proto__']);
            });

            it('keeps __proto__ as an own property inside arrays', () => {
                const result: any = camelKeysToSnake({
                    requests: [malicious()]
                });
                const user = result.requests[0];

                expect(Object.getPrototypeOf(user)).toBe(Object.prototype);
                expect(user.user_name).toBe('guest');
                expect(user.is_admin).toBeUndefined();
            });
        });
    });

    describe('snakeKeysToCamel', () => {
        it('converts nested keys', () => {
            expect(
                snakeKeysToCamel({
                    some_key: 1,
                    'dash-key': 2,
                    nested_list: [{ inner_key: 'a' }]
                })
            ).toEqual({
                someKey: 1,
                dashKey: 2,
                nestedList: [{ innerKey: 'a' }]
            });
        });

        it('does not turn a __proto__ key into a prototype', () => {
            const result: any = snakeKeysToCamel(
                JSON.parse('{"__proto__":{"is_admin":true}}')
            );

            expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
            expect(result.isAdmin).toBeUndefined();
            expect(result.is_admin).toBeUndefined();
        });
    });

    it('leaves primitives unchanged', () => {
        expect(camelKeysToSnake('someKey')).toBe('someKey');
        expect(snakeKeysToCamel(null)).toBeNull();
    });
});
