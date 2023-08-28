const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: path.resolve(__dirname, './lib/index.ts'),
  module: {
    rules: [
      {
        test: /\.ts?$/,
        loader: 'ts-loader',
        exclude: path.resolve(__dirname, '/node_modules'),
        options: { allowTsInNodeModules: true }
      },
    ],
  },
  plugins: [
	new NodePolyfillPlugin(),
    new CleanWebpackPlugin()
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'index.js',
    library: {
      name: '@lightninglabs/lnc-core',
      type: "umd",  // see https://webpack.js.org/configuration/output/#outputlibrarytype
    },
    globalObject: 'this',
    path: path.resolve(__dirname, 'dist'),
  },
};
