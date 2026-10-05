const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
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
        test: /\.svg$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src/'),
      '@objects': path.resolve(__dirname, 'src/objects/'),
      '@managers': path.resolve(__dirname, 'src/managers/'),
      '@scenes': path.resolve(__dirname, 'src/scenes/'),
      '@config': path.resolve(__dirname, 'src/config/'),
      '@types': path.resolve(__dirname, 'src/types/'),
    },
  },
  devServer: {
    static: './dist',
    port: 8080,
    hot: true,
    compress: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: 'index.html',
    }),
  ],
};
