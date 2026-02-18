// Fix React Native 0.84 URL type declarations.
// RN 0.84 incorrectly marks URL properties as readonly, but per the web
// standard (and lib.dom.d.ts), properties like pathname, hash, port, etc.
// are writable. This augmentation restores the correct types.

interface URL {
    hash: string;
    host: string;
    hostname: string;
    href: string;
    password: string;
    pathname: string;
    port: string;
    protocol: string;
    search: string;
    username: string;
}
