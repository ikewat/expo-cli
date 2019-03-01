const path = require('path');
const webpack = require('webpack');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const getLocations = require('./getLocations');

function getAppManifest({ locations, nativeAppManifest }) {
  const { expo } = nativeAppManifest;
  const pwaManifest = require(locations.template.manifest);
  const web = pwaManifest || {};

  return {
    // facebookScheme
    // facebookAppId
    // facebookDisplayName
    name: expo.name,
    description: expo.description,
    slug: expo.slug,
    sdkVersion: expo.sdkVersion,
    version: expo.version,
    githubUrl: expo.githubUrl,
    orientation: expo.orientation,
    primaryColor: expo.primaryColor,
    privacy: expo.privacy,
    icon: expo.icon,
    scheme: expo.scheme,
    notification: expo.notification,
    splash: expo.splash,
    androidShowExponentNotificationInShellApp: expo.androidShowExponentNotificationInShellApp,
    web,
  };
}
const ENV_VAR_REGEX = /^(EXPO_|REACT_NATIVE_)/i;
const publicUrl = '';

function getClientEnvironment({ locations, development, nativeAppManifest }) {
  let processEnv = Object.keys(process.env)
    .filter(key => ENV_VAR_REGEX.test(key))
    .reduce(
      (env, key) => {
        env[key] = JSON.stringify(process.env[key]);
        return env;
      },
      {
        // Useful for determining whether we’re running in production mode.
        // Most importantly, it switches React into the correct mode.
        NODE_ENV: JSON.stringify(development ? 'development' : 'production'),

        // Useful for resolving the correct path to static assets in `public`.
        // For example, <img src={process.env.PUBLIC_URL + '/img/logo.png'} />.
        // This should only be used as an escape hatch. Normally you would put
        // images into the root folder and `import` them in code to get their paths.
        PUBLIC_URL: JSON.stringify(publicUrl),

        // Surface the manifest for use in expo-constants
        APP_MANIFEST: JSON.stringify(getAppManifest({ locations, nativeAppManifest })),
      }
    );
  return {
    'process.env': processEnv,
    __DEV__: Boolean(development),
  };
}

function generateHTMLFromAppJSON({ locations, nativeAppManifest }) {
  const { expo: expoManifest = {} } = nativeAppManifest;

  const metaTags = {
    viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no',
    description: expoManifest.description || 'A Neat Expo App',
    'theme-color': expoManifest.primaryColor || '#000000',
    'apple-mobile-web-app-capable': 'yes',
    // default, black, black-translucent
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': expoManifest.name,
    'application-name': expoManifest.name,
    // Windows
    'msapplication-navbutton-color': '',
    'msapplication-TileColor': '',
    'msapplication-TileImage': '',
  };

  // Generates an `index.html` file with the <script> injected.
  return new HtmlWebpackPlugin({
    /**
     * The file to write the HTML to.
     * Default: `'index.html'`.
     */
    filename: locations.production.indexHtml,
    /**
     * The title to use for the generated HTML document.
     * Default: `'Webpack App'`.
     */
    title: expoManifest.name,
    /**
     * Pass a html-minifier options object to minify the output.
     * https://github.com/kangax/html-minifier#options-quick-reference
     * Default: `false`.
     */
    minify: {
      removeComments: true,
      /* Prod */
      collapseWhitespace: true,
      removeRedundantAttributes: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeStyleLinkTypeAttributes: true,
      keepClosingSlash: true,
      minifyJS: true,
      minifyCSS: true,
      minifyURLs: true,
    },
    /**
     * Adds the given favicon path to the output html.
     * Default: `false`.
     */
    favicon: locations.template.favicon,
    /**
     * Allows to inject meta-tags, e.g. meta: `{viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no'}`.
     * Default: `{}`.
     */
    meta: metaTags,
    /**
     * The `webpack` require path to the template.
     * @see https://github.com/jantimon/html-webpack-plugin/blob/master/docs/template-option.md
     */
    template: locations.template.indexHtml,
  });
}

// Only compile files from react-native, and expo libraries.
const includeModulesThatContainPaths = [
  'node_modules/react-native',
  'node_modules/react-navigation',
  'node_modules/expo',
  'node_modules/@react',
  'node_modules/@expo',
];

const babelLoaderConfiguration = locations => ({
  test: /\.jsx?$/,
  include(inputPath) {
    for (const option of includeModulesThatContainPaths) {
      if (inputPath.includes(option)) {
        return inputPath;
      }
    }
    // Is inside the project and is not one of designated modules
    if (!inputPath.includes('node_modules') && inputPath.includes(locations.root)) {
      return inputPath;
    }
    return null;
  },
  use: {
    loader: require.resolve('babel-loader'),
    options: {
      cacheDirectory: false,
      babelrc: false,
    },
  },
});

// This is needed for webpack to import static images in JavaScript files.
const imageLoaderConfiguration = {
  test: /\.(gif|jpe?g|png|svg)$/,
  use: {
    loader: require.resolve('url-loader'),
    // loader: 'file-loader',
    options: {
      name: '[name].[ext]',
    },
  },
};

// This is needed for loading css
const cssLoaderConfiguration = {
  test: /\.css$/,
  use: [require.resolve('style-loader'), require.resolve('css-loader')],
};

const ttfLoaderConfiguration = locations => ({
  test: /\.ttf$/,
  use: [
    {
      loader: require.resolve('url-loader'),
      // loader: 'file-loader',
      options: {
        name: './fonts/[name].[ext]',
      },
    },
  ],
  include: [
    locations.root,
    locations.nodeModulesPath('react-native-vector-icons'),
    locations.nodeModulesPath('@expo/vector-icons'),
  ],
});

const htmlLoaderConfiguration = locations => ({
  test: /\.html$/,
  use: [require.resolve('html-loader')],
  include: [locations.absolute('assets')],
});

const mediaLoaderConfiguration = {
  test: /\.(mov|mp4|mp3|wav)$/,
  use: [
    {
      loader: require.resolve('file-loader'),
      options: {
        name: '[path][name].[ext]',
      },
    },
  ],
};

const publicPath = '/';

module.exports = function common(env) {
  const { projectRoot } = env;
  const locations = getLocations(projectRoot);
  const nativeAppManifest = require(locations.appJson);

  // This method intercepts modules being referenced in react-native
  // and redirects them to web friendly versions in expo.
  function getWebModule(initialRoot, moduleName) {
    return function(res) {
      if (res.context.includes('node_modules/react-native/')) {
        res.request = locations.nodeModulesPath(initialRoot + moduleName);
      }
    };
  }

  function useWebModule(modulePathToHiJack, redirectPath, initialRoot = 'expo/build/web/') {
    return new webpack.NormalModuleReplacementPlugin(
      new RegExp(modulePathToHiJack),
      getWebModule(initialRoot, redirectPath)
    );
  }

  return {
    // mode: environment,
    context: __dirname,
    // configures where the build ends up
    output: {
      path: locations.production.folder,
      filename: 'static/[chunkhash].js',
      sourceMapFilename: '[chunkhash].map',
      // There are also additional JS chunk files if you use code splitting.
      chunkFilename: 'static/[id].[chunkhash].js',
      // This is the URL that app is served from. We use "/" in development.
      publicPath,
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        name: false,
      },
      runtimeChunk: 'single',
    },
    module: {
      // strictExportPresence: true,

      rules: [
        { parser: { requireEnsure: false } },

        htmlLoaderConfiguration(locations),
        babelLoaderConfiguration(locations),
        cssLoaderConfiguration,
        imageLoaderConfiguration,
        ttfLoaderConfiguration(locations),
        mediaLoaderConfiguration,
      ],
    },
    plugins: [
      // Generates an `index.html` file with the <script> injected.
      generateHTMLFromAppJSON({ locations, nativeAppManifest }),

      new InterpolateHtmlPlugin(HtmlWebpackPlugin, {
        PUBLIC_URL: publicUrl,
        WEB_TITLE: nativeAppManifest.expo.name,
      }),

      // Generate a manifest file which contains a mapping of all asset filenames
      // to their corresponding output file so that tools can pick it up without
      // having to parse `index.html`.
      new ManifestPlugin({
        fileName: 'asset-manifest.json',
        publicPath,
      }),

      new webpack.DefinePlugin(
        getClientEnvironment({ locations, development: env.development, nativeAppManifest })
      ),

      useWebModule('Platform', 'Utilities/Platform'),
      useWebModule('Performance/Systrace', 'Performance/Systrace'),
      useWebModule('HMRLoadingView', 'Utilities/HMRLoadingView'),
      useWebModule('RCTNetworking', 'Network/RCTNetworking'),

      new WorkboxPlugin.GenerateSW({
        skipWaiting: true,
        clientsClaim: true,
        exclude: [/\.LICENSE$/, /\.map$/, /asset-manifest\.json$/],
        importWorkboxFrom: 'cdn',
        navigateFallback: `${publicUrl}/index.html`,
        navigateFallbackBlacklist: [new RegExp('^/_'), new RegExp('/[^/]+\\.[^/]+$')],
        runtimeCaching: [
          {
            urlPattern: /(.*?)/,
            handler: 'staleWhileRevalidate',
          },
        ],
      }),
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: false,
      }),
    ],
    resolve: {
      symlinks: false,
      extensions: ['.web.js', '.js', '.jsx', '.json'],
      alias: Object.assign(
        {
          /* Alias direct react-native imports to react-native-web */
          'react-native$': 'react-native-web',
          /* Add polyfills for modules that react-native-web doesn't support */
          'react-native/Libraries/Image/AssetSourceResolver$':
            'expo/build/web/Image/AssetSourceResolver',
          'react-native/Libraries/Image/assetPathUtils$': 'expo/build/web/Image/assetPathUtils',
          'react-native/Libraries/Image/resolveAssetSource$':
            'expo/build/web/Image/resolveAssetSource',
        },
        [
          'ActivityIndicator',
          'Alert',
          'AsyncStorage',
          'Button',
          'DeviceInfo',
          'Modal',
          'NativeModules',
          'Network',
          'Platform',
          'SafeAreaView',
          'SectionList',
          'StyleSheet',
          'Switch',
          'Text',
          'TextInput',
          'TouchableHighlight',
          'TouchableWithoutFeedback',
          'View',
          'ViewPropTypes',
        ].reduce(
          (acc, curr) => {
            acc[curr] = `react-native-web/dist/cjs/exports/${curr}`;
            return acc;
          },
          {
            JSEventLoopWatchdog:
              'react-native-web/dist/cjs/vendor/react-native/JSEventLoopWatchdog',
            React$: 'react',
            ReactNative$: 'react-native-web/dist/cjs',
            infoLog$: 'react-native-web/dist/cjs/vendor/react-native/infoLog',
          }
        )
      ),
    },
    // Some libraries import Node modules but don't use them in the browser.
    // Tell Webpack to provide empty mocks for them so importing them works.
    node: {
      dgram: 'empty',
      fs: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty',
    },
    // Turn off performance processing because we utilize
    // our own hints via the FileSizeReporter
    performance: false,
  };
};
