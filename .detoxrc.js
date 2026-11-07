const { execFileSync } = require('child_process');

const metroPort = process.env.RCT_METRO_PORT || '8081';

const IOS_DEVICE_TYPE = 'iPhone 17';
const IOS_VERSION = 'iOS 26.5';

// Detox names the simulators it clones "<name>-Detox".
const isDetoxClone = (name) => name.endsWith('-Detox');

// Runs on the iPhone simulator that is already booted, so a run doesn't start a
// second one, preferring an iPhone 17 with iOS 26.5, and otherwise boots one.
// launchFreshApp uninstalls Zeus and resets the keychain on whichever
// simulator it uses.
const resolveIosDevice = () => {
    if (process.env.DETOX_IOS_DEVICE) {
        return { name: process.env.DETOX_IOS_DEVICE };
    }
    if (process.platform === 'darwin') {
        const { devices } = JSON.parse(
            execFileSync(
                'xcrun',
                ['simctl', 'list', 'devices', 'booted', '--json'],
                { encoding: 'utf8' }
            )
        );
        const runtimeId = `iOS-${IOS_VERSION.replace(/^iOS /, '').replace(
            '.',
            '-'
        )}`;
        const booted = Object.entries(devices)
            .flatMap(([runtime, list]) =>
                list.map((device) => ({ ...device, runtime }))
            )
            .filter(
                ({ name }) => name.startsWith('iPhone') && !isDetoxClone(name)
            );
        const preferred =
            booted.find(
                ({ name, runtime }) =>
                    name === IOS_DEVICE_TYPE && runtime.endsWith(runtimeId)
            ) || booted[0];
        if (preferred) {
            return { id: preferred.udid };
        }
    }
    return { type: IOS_DEVICE_TYPE, os: IOS_VERSION };
};

const iosBuild = (configuration) =>
    `xcodebuild -workspace ios/zeus.xcworkspace -scheme zeus -configuration ${configuration} -sdk iphonesimulator -derivedDataPath ios/build -destination 'generic/platform=iOS Simulator' ARCHS=arm64 ONLY_ACTIVE_ARCH=YES`;

// Detox waits for the app to go idle before every action. Zeus keeps Nostr
// relay and mint lookups running in the background, so network traffic is
// left out of that check; the tests wait for the elements they need instead.
const iosLaunchArgs = {
    detoxURLBlacklistRegex: '\\(".*"\\)'
};

/** @type {Detox.DetoxConfig} */
module.exports = {
    testRunner: {
        args: {
            $0: 'jest',
            config: 'e2e/jest.config.js'
        },
        jest: {
            setupTimeout: 300000
        }
    },
    artifacts: {
        rootDir: 'e2e/artifacts',
        plugins: {
            log: 'failing',
            screenshot: 'failing'
        }
    },
    apps: {
        'ios.debug': {
            type: 'ios.app',
            binaryPath:
                'ios/build/Build/Products/Debug-iphonesimulator/zeus.app',
            build: iosBuild('Debug'),
            launchArgs: {
                ...iosLaunchArgs,
                RCT_jsLocation: `localhost:${metroPort}`
            }
        },
        'ios.release': {
            type: 'ios.app',
            binaryPath:
                'ios/build/Build/Products/Release-iphonesimulator/zeus.app',
            build: iosBuild('Release'),
            launchArgs: iosLaunchArgs
        },
        'android.debug': {
            type: 'android.apk',
            binaryPath:
                'android/app/build/outputs/apk/debug/app-universal-debug.apk',
            testBinaryPath:
                'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
            build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug -PreactNativeDebugArchitectures=${DETOX_ANDROID_ABI:-arm64-v8a}',
            reversePorts: [Number(metroPort)]
        }
    },
    devices: {
        simulator: {
            type: 'ios.simulator',
            device: resolveIosDevice()
        },
        emulator: {
            type: 'android.emulator',
            device: {
                avdName: process.env.DETOX_ANDROID_AVD || 'Pixel_8'
            }
        }
    },
    configurations: {
        'ios.sim.debug': {
            device: 'simulator',
            app: 'ios.debug'
        },
        'ios.sim.release': {
            device: 'simulator',
            app: 'ios.release'
        },
        'android.emu.debug': {
            device: 'emulator',
            app: 'android.debug'
        }
    }
};
