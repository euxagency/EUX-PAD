const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/**
 * Build config for both frontend PAD app and admin UI.
 *
 * Outputs (one JS + one CSS per app):
 * - assets/js/pad-app.js       + assets/css/pad-app.css
 * - assets/js/wpd-admin-app.js + assets/css/wpd-admin-app.css
 *
 * PHP already enqueues these exact filenames.
 */
module.exports = {
  entry: {
    'pad-app': './src/frontend/pad-app.js',
    'wpd-admin-app': './src/admin/wpd-admin-app.js',
  },
  output: {
    path: path.resolve(__dirname, 'assets/js'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: { importLoaders: 1 },
          },
          {
            loader: 'postcss-loader',
          },
        ],
      },
    ],
  },
  externals: {
    '@wordpress/element': 'wp.element',
    '@wordpress/i18n': 'wp.i18n',
    '@wordpress/components': 'wp.components',
    '@wordpress/api-fetch': 'wp.apiFetch',
  },
  plugins: [
    new MiniCssExtractPlugin({
      // CSS files go to assets/css/[name].css
      filename: '../css/[name].css',
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};

