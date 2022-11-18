import { snakeCase, isArray, isObject, transform } from 'lodash';

// change responses from camel-case to snake-case
const snakeize = (obj) =>
    transform(obj, (acc, value, key, target) => {
        const snakeKey = isArray(target) ? key : snakeCase(key);
        acc[snakeKey] = isObject(value) ? snakeize(value) : value;
    });

export { snakeize };
