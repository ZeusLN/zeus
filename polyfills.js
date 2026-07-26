// Global polyfills that must be installed before any other module loads.
// Hermes has no TextEncoder/TextDecoder, and protobufjs v8+ reads
// TextDecoder at import time, so this module must be the first import
// in index.js — imports are hoisted, so assigning these globals from
// index.js's own body runs too late.
const TextEncodingPolyfill = require('text-encoding');

if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncodingPolyfill.TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextEncodingPolyfill.TextDecoder;
}
