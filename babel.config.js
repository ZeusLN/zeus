module.exports = {
  // RN 0.87 changed the preset's default transform profile from 'default' to
  // 'hermes-stable', which sets preserveClasses and therefore stops shipping
  // @babel/plugin-transform-class-properties. MobX 5's legacy decorators
  // require that transform, so without it every @observable class property
  // throws "Decorating class property failed" at runtime.
  //
  // We pin the profile rather than re-adding the plugin ourselves: a plugin
  // listed here runs *before* the preset strips TypeScript types, so it would
  // treat type-only declarations (`payment_hash: string;`) as real class
  // fields and emit `this.payment_hash = void 0` after super(). That silently
  // wipes everything BaseModel's constructor assigns.
  //
  // TODO: migrate the models' type-only fields to `declare` so the
  // hermes-stable profile (and its Hermes V1 optimisations) can be restored.
  presets: [
    ["module:@react-native/babel-preset", { unstable_transformProfile: "default" }]
  ],
  plugins: [
    ["@babel/plugin-proposal-decorators", { legacy: true }],
    'react-native-reanimated/plugin'
  ]
}