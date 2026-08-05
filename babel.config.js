module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [
    ["@babel/plugin-proposal-decorators", { legacy: true }],
    'react-native-reanimated/plugin'
  ],
  env: {
    production: {
      // Strip all console.* calls from release bundles. console output lands
      // verbatim in logcat / os_log on release builds and has repeatedly
      // leaked sensitive material (preimages, bearer tokens, swap keys).
      plugins: ['transform-remove-console']
    }
  }
}
