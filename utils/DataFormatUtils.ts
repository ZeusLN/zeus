import snakeCase from 'lodash/snakeCase';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import transform from 'lodash/transform';

/**
 * Recursively transforms an object's keys from camelCase to snake_case.
 *
 * @param obj - The object to transform
 * @returns A new object with all keys converted to snake_case
 */
export function snakeize<T extends object>(obj: T): T {
    return transform(obj, (acc: any, value: any, key: string, target: any) => {
        const snakeKey = isArray(target) ? key : snakeCase(key);
// change responses from camel-case to snake-case
const snakeize = (obj: any) =>
    transform(obj, (acc: any, value, key, target) => {
        const snakeKey = isArray(target) ? key : snakeCase(key.toString());
        acc[snakeKey] = isObject(value) ? snakeize(value) : value;
    });
}
