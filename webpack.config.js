const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { DefinePlugin } = require('webpack');

// `--env release` (npm run build:release, the production page) strips the developer tools (src/core/devTools.ts).
module.exports = (env = {}) => ({
  mode: process.env.NODE_ENV || 'development',
  entry: './src/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true,
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(svg|mp3)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  devServer: {
    static: './dist',
    port: Number(process.env.PORT) || 8080,
    hot: true,
    compress: true,
  },
  plugins: [
    new DefinePlugin({ __DEV_TOOLS__: JSON.stringify(!env.release) }),
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: 'index.html',
    }),
  ],
});
