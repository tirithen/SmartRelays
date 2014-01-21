/* global require, module */

var express = require('express'),
    helmet = require('helmet'),
    lessMiddleware = require('less-middleware'),
    MongoStore = require('connect-mongo')(express);

function setupServerSecurity(server) {
    'use strict';

    server.use(helmet.xframe());
    server.use(helmet.iexss());
    server.use(helmet.contentTypeOptions());
    server.use(helmet.cacheControl());
}

function createServer(server, configuration, callback) {
    'use strict';

    // TODO: add cache headers
    setupServerSecurity(server);
    server.use(express.compress()); // gzip HTML, CSS, JavaScript, and JSON responses
    server.use(lessMiddleware({
        src: configuration.directories.less,
        dest: configuration.directories.stylesheets,
        prefix: '/' + configuration.directories.stylesheets.split('/').pop(),
        compress: true
    }));
    server.use(express.bodyParser());
    server.use(express.methodOverride());
    server.cookieParser = express.cookieParser(configuration.cookieSecret);
    server.use(server.cookieParser);
    server.sessionStore = new MongoStore({
        url: configuration.databaseConnectionString,
        auto_reconnect: true
    });
    server.use(express.session({
        secret: configuration.cookieSecret,
        key: 'express.sid',
        store: server.sessionStore
    }));
    server.use(express.static(configuration.directories.static));
    server.set('views', configuration.directories.views);
    server.set('view engine', configuration.viewsEngine);

    callback();
}

module.exports = function (configuration, callback) {
    'use strict';

    var server = express();

    server.express = express;
    createServer(server, configuration, function () {
        callback(server);
    });
};
