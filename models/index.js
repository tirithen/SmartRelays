/* global require, module, __dirname */

var mongoose = require('mongoose'),
    fs = require('fs'),
    jsExtensionRegEx = /\.js$/i,
    rightTrimPathRegEx = /[\/\s]+$/;

function loadModelsFrom(directory) {
    'use strict';

    directory = directory.replace(rightTrimPathRegEx, '');
    fs.readdirSync(directory).forEach(function (filename) {
        if (filename.match(jsExtensionRegEx) && filename !== 'index.js') {
            filename = filename.replace(jsExtensionRegEx, '');
            console.log('Register model', filename);
            module.exports[filename] = require('./' + filename)(mongoose);
        }
    });
}

module.exports.initialize = function (configuration) {
    'use strict';

    mongoose.connect(configuration.databaseConnectionString);
    loadModelsFrom(__dirname);
    module.exports.mongoose = mongoose;

    return module.exports;
};
