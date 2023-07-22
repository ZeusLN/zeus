/**
 * Returns true if the value provided is a Javascript object but not a function or
 * an array
 */
export declare const isObject: (o: any) => boolean;
/**
 * Recursively converts the keys of a Javascript object from snake-case to camel-case
 * Ex: { some-key: 'foo' } becomes { someKey: 'foo' }
 * @param o any Javascript object
 */
export declare const snakeKeysToCamel: <T>(o: any) => T;
/**
 * Recursively converts the keys of a Javascript object from camel-case to snake-case
 * Ex: { someKey: 'foo' } becomes { some-key: 'foo' }
 * @param o any Javascript object
 */
export declare const camelKeysToSnake: <T>(o: any) => T;
//# sourceMappingURL=objects.d.ts.map