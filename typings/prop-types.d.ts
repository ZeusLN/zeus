declare module 'prop-types' {
    export const any: any;
    export const array: any;
    export const arrayOf: (type: any) => any;
    export const bool: any;
    export const element: any;
    export const elementType: any;
    export const exact: (obj: object) => any;
    export const func: any;
    export const instanceOf: (type: any) => any;
    export const node: any;
    export const number: any;
    export const object: any;
    export const objectOf: (type: any) => any;
    export const oneOf: (types: any[]) => any;
    export const oneOfType: (types: any[]) => any;
    export const shape: (obj: object) => any;
    export const string: any;
    export const symbol: any;
}
