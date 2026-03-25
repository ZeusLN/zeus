declare var global: any;
declare module 'debug' {
    interface Debugger {
        (formatter: any, ...args: any[]): void;
    }
    function debug(namespace: string): Debugger;
    export { Debugger };
    export default debug;
}
