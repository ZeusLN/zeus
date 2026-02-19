"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelKeysToSnake = exports.snakeKeysToCamel = exports.isObject = void 0;
/**
 * Converts a string from snake-case to camel-case
 */
var toCamel = function (text) {
    return text.replace(/([-_][a-z])/gi, function (match) {
        return match.toUpperCase().replace('-', '').replace('_', '');
    });
};
/**
 * Converts a string from camel-case to snake-case
 */
var toSnake = function (str) {
    return str.replace(/[A-Z]/g, function (letter) { return "_".concat(letter.toLowerCase()); });
};
/**
 * Returns true if the value provided is an array
 */
var isArray = function (o) {
    return Array.isArray(o);
};
/**
 * Returns true if the value provided is a Javascript object but not a function or
 * an array
 */
var isObject = function (o) {
    return o === Object(o) && !isArray(o) && typeof o !== 'function';
};
exports.isObject = isObject;
/**
 * Recursively converts the keys of a Javascript object from snake-case to camel-case
 * Ex: { some-key: 'foo' } becomes { someKey: 'foo' }
 * @param o any Javascript object
 */
var snakeKeysToCamel = function (o) {
    if ((0, exports.isObject)(o)) {
        var n_1 = {};
        Object.keys(o).forEach(function (k) {
            n_1[toCamel(k)] = (0, exports.snakeKeysToCamel)(o[k]);
        });
        return n_1;
    }
    else if (isArray(o)) {
        return o.map(function (i) {
            return (0, exports.snakeKeysToCamel)(i);
        });
    }
    return o;
};
exports.snakeKeysToCamel = snakeKeysToCamel;
/**
 * Recursively converts the keys of a Javascript object from camel-case to snake-case
 * Ex: { someKey: 'foo' } becomes { some-key: 'foo' }
 * @param o any Javascript object
 */
var camelKeysToSnake = function (o) {
    if ((0, exports.isObject)(o)) {
        var n_2 = {};
        Object.keys(o).forEach(function (k) {
            n_2[toSnake(k)] = (0, exports.camelKeysToSnake)(o[k]);
        });
        return n_2;
    }
    else if (isArray(o)) {
        return o.map(function (i) {
            return (0, exports.camelKeysToSnake)(i);
        });
    }
    return o;
};
exports.camelKeysToSnake = camelKeysToSnake;
