import { NativeModules, Platform } from 'react-native';
const isNativePlatform = ['android', 'ios'].includes(Platform.OS);

const log = (tag?: string) => {
    tag = tag ?? '';

    return {
        v: (message: string, data: any[] = []) => {
            const msg = fixMessage(message, data);
            console.debug(`${tag}: ${msg}`);
            if (isNativePlatform) {
                NativeModules.LndMobileTools.log('v', tag!, msg);
            }
        },

        d: (message: string, data: any[] = []) => {
            const msg = fixMessage(message, data);
            console.debug(`${tag}: ${msg}`);
            if (isNativePlatform) {
                NativeModules.LndMobileTools.log('d', tag!, msg);
            }
        },

        i: (message: string, data: any[] = []) => {
            const msg = fixMessage(message, data);
            console.log(`${tag}: ${msg}`);
            if (isNativePlatform) {
                NativeModules.LndMobileTools.log('i', tag!, msg);
            }
        },

        w: (message: string, data: any[] = []) => {
            const msg = fixMessage(message, data);
            console.warn(`${tag}: ${msg}`);
            if (isNativePlatform) {
                NativeModules.LndMobileTools.log('w', tag!, msg);
            }
        },

        e: (message: string, data: any[] = []) => {
            const msg = fixMessage(message, data);
            console.error(`${tag}: ${msg}`);
            if (isNativePlatform) {
                NativeModules.LndMobileTools.log('e', tag!, msg);
            }
        }
    };
};

export default log;

const processDataArg = (data: any[]) =>
    data
        .map((d) => {
            if (d instanceof Error) {
                return JSON.stringify({
                    name: d.name,
                    message: d.message
                    // stack: d.stack,
                });
            }
            return JSON.stringify(d);
        })
        .join('\n  ');

const fixMessage = (message: string, data: any[]) => {
    if (!Array.isArray(data)) {
        log('log.ts').e(
            `Invalid data arg passed to logging function: ${JSON.stringify(
                data
            )}. Must be an array`
        );
    }
    if (data.length > 0) {
        message += `\n  ${processDataArg(data)}`;
    }
    return message;
};
