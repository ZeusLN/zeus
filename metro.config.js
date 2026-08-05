const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
    transformer: {
        babelTransformerPath: require.resolve('react-native-svg-transformer')
    },
    resolver: {
        assetExts: defaultConfig.resolver.assetExts.filter(
            (ext) => ext !== 'svg'
        ),
        sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
        // Nested react-native under zeus_modules (e.g. lnc-rn after a local
        // yarn) would otherwise shadow the app copy and crash on
        // PlatformConstants / TurboModuleRegistry.
        blockList: [
            defaultConfig.resolver.blockList,
            /zeus_modules[/\\].+[/\\]node_modules[/\\]react-native[/\\].*/,
            /zeus_modules[/\\].+[/\\]node_modules[/\\]@react-native[/\\].*/
        ],
        extraNodeModules: {
            'react-native': path.resolve(__dirname, 'node_modules/react-native')
        }
    }
};

module.exports = mergeConfig(defaultConfig, config);
