// Karma configuration
// Generated on Tue Mar 01 2016 16:57:03 GMT+0800 (China Standard Time)

module.exports = function(config) {
  config.set({

    transports: ['websocket', 'polling', 'jsonp-polling'],

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'expect', 'commonjs'],


    // list of files / patterns to load in the browser
    files: [
      'src/**/*.js'
    ],


    // list of files to exclude
    exclude: [],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'src/**/*.js': ['babel', 'commonjs']
    },

    babelPreprocessor: {
      options: {
        sourceMap: 'inline'
      }
    },

    commonjsPreprocessor: {
      modulesRoot: 'src'
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],

    specReporter: {
      maxLogLines: 5, // limit number of lines logged per test
      suppressErrorSummary: false, // do not print error summary
      suppressFailed: false, // do not print information about failed tests
      suppressPassed: false, // do not print information about passed tests
      suppressSkipped: true // do not print information about skipped tests
    },

    plugins: [
      require('karma-mocha'),
      require('karma-expect'),
      require('karma-commonjs'),
      require('karma-babel-preprocessor'),
      require('karma-sourcemap-loader'),
      require('karma-chrome-launcher'),
      require('karma-phantomjs-launcher'),
      require('karma-browserstack-launcher')
    ],

    browserStack: {
      startTunnel: true,
      username: 'zengtao1',
      accessKey: 'zHfsL9fBGjiXmux7mj1M'
    },

    // define browsers
    customLaunchers: {
      BS_IE10: {
        base: 'BrowserStack',
        browser_version: '10.0',
        os_version: '8',
        browser: 'ie',
        os: 'Windows'
      }
    },

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['BS_IE10'],

    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,

    client: {
      clearContext: false,
      captureConsole: false,
      mocha: {
        reporter: 'html', // change Karma's debug.html to the mocha web reporter
        ui: 'bdd'
      }
    }
  })
}
