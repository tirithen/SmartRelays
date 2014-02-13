module.exports = {
    port: 2000,
    cookieSecret: 'wie4Rah3eGh{a2abAhsh1oi]',
    databaseConnectionString: 'mongodb://localhost/smartrelays',
    viewsEngine: 'jade',
    directories: {
        static: __dirname + '/static',
        stylesheets: __dirname + '/static/stylesheets',
        less: __dirname + '/less',
        views: __dirname + '/views'
    }
};
