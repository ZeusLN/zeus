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
            /zeus_modules[/\\].+[/\\]node_modules[/\\]react-native[/\\]/,
            /zeus_modules[/\\].+[/\\]node_modules[/\\]@react-native[/\\]/
        ],
        extraNodeModules: {
            'react-native': path.resolve(__dirname, 'node_modules/react-native')
        },
        // @react-native-vector-icons/common imports
        // '@react-native/assets-registry/registry'. Up to RN 0.86 that package
        // was pulled in by react-native itself and
        // Libraries/Image/AssetRegistry simply re-exported it, so the app and
        // the icon packages shared one registry instance. RN 0.87 moved the
        // registry in-tree (react-native/asset-registry, which is also what
        // metro-config now sets as assetRegistryPath) and dropped the
        // dependency, so the import no longer resolves.
        //
        // Alias it to react-native's copy rather than installing the standalone
        // package: a second copy would resolve fine but register assets into a
        // different Map, so getAssetByID would silently return undefined.
        resolveRequest: (context, moduleName, platform) =>
            context.resolveRequest(
                context,
                moduleName === '@react-native/assets-registry/registry'
                    ? 'react-native/asset-registry'
                    : moduleName,
                platform
            )
    }
};

module.exports = mergeConfig(defaultConfig, config);
