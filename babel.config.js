module.exports = (api) => {
    // RN 0.87's preset defaults to the 'hermes-stable' transform profile when
    // the caller does not choose one (Jest). Metro passes 'default' unless the
    // bundle is built with --unstable-transform-profile hermes-stable.
    const profile = api.caller(
        (caller) => caller?.unstable_transformProfile ?? 'hermes-stable'
    );
    const isHermesProfile =
        profile === 'hermes-stable' || profile === 'hermes-canary';

    return {
        presets: [
            // Hermes profiles preserve classes and drop
            // @babel/plugin-transform-class-properties, which MobX 5's legacy
            // decorators need, so add it back for those profiles only. It must run
            // after the preset's TypeScript transform has stripped type-only fields
            // (`payment_hash: string;`); otherwise they become real fields and emit
            // `this.payment_hash = void 0` after super(), wiping what BaseModel's
            // constructor assigned. Presets run last to first, so listing it ahead
            // of RN's preset is what places it after the TypeScript transform. Do
            // not move it into `plugins`, which run before all presets.
            ...(isHermesProfile
                ? [
                      {
                          plugins: [
                              [
                                  '@babel/plugin-transform-class-properties',
                                  { loose: true }
                              ]
                          ]
                      }
                  ]
                : []),
            'module:@react-native/babel-preset'
        ],
        plugins: [
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            'react-native-reanimated/plugin'
        ]
    };
};
