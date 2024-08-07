import snakeCase from 'lodash/snakeCase';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import transform from 'lodash/transform';

// change responses from camel-case to snake-case
const snakeize = (obj) =>
    transform(obj, (acc, value, key, target) => {
        const snakeKey = isArray(target) ? key : snakeCase(key);
        acc[snakeKey] = isObject(value) ? snakeize(value) : value;
    });

export { snakeize };
