import BigNumber from 'bignumber.js';

// bignumber.js 10+ throws on invalid input by default (STRICT: true). ZEUS
// relies on the 9.x behavior: unparseable strings, '', undefined and null
// become NaN, and protobufjs Long values from embedded LND convert through
// toString(). Turn strict mode off before any other module constructs a
// BigNumber.
//
// This must be an ES import: Metro resolves `import` to dist/bignumber.mjs
// and `require` to dist/bignumber.cjs, which are separate constructors, so
// configuring the CommonJS build would not reach the app's imports. It is
// imported right after ./polyfills in index.js and listed in Jest's
// setupFiles.
BigNumber.config({ STRICT: false });
