// Detox configuration for the E2E suite in e2e/. See docs/E2ETesting.md.
const { execFileSync } = require('child_process');

// Overrides, all optional:
// - DETOX_IOS_DEVICE: an iOS simulator to run on, by name
// - DETOX_ANDROID_AVD: the Android emulator to run on
// - DETOX_ANDROID_ABI: the ABI to build for Android, e.g. x86_64 on Intel
// - RCT_METRO_PORT: the Metro port for debug builds
const env = {
    iosDevice: process.env.DETOX_IOS_DEVICE,
    androidAvd: process.env.DETOX_ANDROID_AVD || 'Pixel_8',
    metroPort: process.env.RCT_METRO_PORT || '8081'
};

/* iOS simulator */

const IOS_DEVICE_TYPE = 'iPhone 18 Pro';
const IOS_VERSION = '27.2';

// simctl keys runtimes by id, e.g. com.apple.CoreSimulator.SimRuntime.iOS-27-2
const IOS_RUNTIME_SUFFIX = `.iOS-${IOS_VERSION.replace('.', '-')}`;

// Installed iPhone simulators with their runtime, skipping the "<name>-Detox"
// clones Detox makes for itself.
const listIphones = () => {
    const { devices } = JSON.parse(
        execFileSync(
            'xcrun',
            ['simctl', 'list', 'devices', 'available', '--json'],
            { encoding: 'utf8' }
        )
    );
    return Object.entries(devices)
        .flatMap(([runtime, list]) =>
            list.map((device) => ({ ...device, runtime }))
        )
        .filter(
            ({ name }) => name.startsWith('iPhone') && !name.endsWith('-Detox')
        );
};

const isPreferred = ({ name, runtime }) =>
    name === IOS_DEVICE_TYPE && runtime.endsWith(IOS_RUNTIME_SUFFIX);

// In order: the simulator named by DETOX_IOS_DEVICE; the booted iPhone,
// preferring the default type and iOS version, so a run doesn't boot a second
// one; an installed simulator of the default type and version. Otherwise
// Detox picks one of the default type on any installed iOS. launchFreshApp
// uninstalls ZEUS and resets the keychain on whichever simulator it uses.
const resolveIosDevice = () => {
    if (env.iosDevice) {
        return { name: env.iosDevice };
    }
    if (process.platform !== 'darwin') {
        return { type: IOS_DEVICE_TYPE };
    }
    const iphones = listIphones();
    const booted = iphones.filter(({ state }) => state === 'Booted');
    const device =
        booted.find(isPreferred) || booted[0] || iphones.find(isPreferred);
    return device ? { id: device.udid } : { type: IOS_DEVICE_TYPE };
};

/* Builds */

const iosBuild = (configuration) =>
    [
        'xcodebuild',
        '-workspace ios/zeus.xcworkspace',
        '-scheme zeus',
        `-configuration ${configuration}`,
        '-sdk iphonesimulator',
        '-derivedDataPath ios/build',
        "-destination 'generic/platform=iOS Simulator'",
        'ARCHS=arm64',
        'ONLY_ACTIVE_ARCH=YES'
    ].join(' ');

const iosBinary = (configuration) =>
    `ios/build/Build/Products/${configuration}-iphonesimulator/zeus.app`;

const androidBuild = [
    'cd android &&',
    './gradlew assembleDebug assembleAndroidTest',
    '-DtestBuildType=debug',
    '-PreactNativeDebugArchitectures=${DETOX_ANDROID_ABI:-arm64-v8a}'
].join(' ');

// Detox waits for the app to go idle before every action. ZEUS keeps Nostr
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
            binaryPath: iosBinary('Debug'),
            build: iosBuild('Debug'),
            launchArgs: {
                ...iosLaunchArgs,
                RCT_jsLocation: `localhost:${env.metroPort}`
            }
        },
        'ios.release': {
            type: 'ios.app',
            binaryPath: iosBinary('Release'),
            build: iosBuild('Release'),
            launchArgs: iosLaunchArgs
        },
        'android.debug': {
            type: 'android.apk',
            binaryPath:
                'android/app/build/outputs/apk/debug/app-universal-debug.apk',
            testBinaryPath:
                'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
            build: androidBuild,
            reversePorts: [Number(env.metroPort)]
        }
    },
    devices: {
        simulator: {
            type: 'ios.simulator',
            device: resolveIosDevice()
        },
        emulator: {
            type: 'android.emulator',
            device: { avdName: env.androidAvd }
        }
    },
    configurations: {
        'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
        'ios.sim.release': { device: 'simulator', app: 'ios.release' },
        'android.emu.debug': { device: 'emulator', app: 'android.debug' }
    }
};
