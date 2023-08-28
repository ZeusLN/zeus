/**
 * Converts a string from snake-case to camel-case
 */
const toCamel = (text: string) => {
    return text.replace(/([-_][a-z])/gi, (match) => {
        return match.toUpperCase().replace('-', '').replace('_', '');
    });
};

/**
 * Converts a string from camel-case to snake-case
 */
const toSnake = (str: string) =>
    str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/**
 * Returns true if the value provided is an array
 */
const isArray = (o: any) => {
    return Array.isArray(o);
};

/**
 * Returns true if the value provided is a Javascript object but not a function or
 * an array
 */
export const isObject = (o: any) => {
    return o === Object(o) && !isArray(o) && typeof o !== 'function';
};

/**
 * Recursively converts the keys of a Javascript object from snake-case to camel-case
 * Ex: { some-key: 'foo' } becomes { someKey: 'foo' }
 * @param o any Javascript object
 */
export const snakeKeysToCamel = <T>(o: any): T => {
    if (isObject(o)) {
        const n: Record<string, unknown> = {};

        Object.keys(o).forEach((k) => {
            n[toCamel(k)] = snakeKeysToCamel(o[k]);
        });

        return n as T;
    } else if (isArray(o)) {
        return o.map((i: any) => {
            return snakeKeysToCamel(i);
        });
    }

    return o;
};

/**
 * Recursively converts the keys of a Javascript object from camel-case to snake-case
 * Ex: { someKey: 'foo' } becomes { some-key: 'foo' }
 * @param o any Javascript object
 */
export const camelKeysToSnake = <T>(o: any): T => {
    if (isObject(o)) {
        const n: Record<string, unknown> = {};

        Object.keys(o).forEach((k) => {
            n[toSnake(k)] = camelKeysToSnake(o[k]);
        });

        return n as T;
    } else if (isArray(o)) {
        return o.map((i: any) => {
            return camelKeysToSnake(i);
        });
    }

    return o;
};
