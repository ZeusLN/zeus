// react-native-get-random-values (loaded first thing in index.js) installs a
// synchronous WebCrypto getRandomValues backed by the OS CSPRNG. tsconfig
// carries no DOM lib, so declare the shape we rely on.
declare const crypto: {
    getRandomValues: <T extends ArrayBufferView>(array: T) => T;
};

// Drop-in replacement for react-native-randombytes' synchronous randomBytes,
// which draws from SJCL's userspace PRNG in JS rather than the OS generator.
export function randomBytes(size: number): Buffer {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(size)));
}
