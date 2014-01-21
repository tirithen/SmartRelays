module.exports = {
    port: 4000,
    cookieSecret: 'wie4Rah3eGh{a2abAhsh1oi]',
    databaseConnectionString: 'mongodb://localhost/smartlamp2',
    viewsEngine: 'jade',
    directories: {
        static: __dirname + '/static',
        stylesheets: __dirname + '/static/stylesheets',
        less: __dirname + '/less',
        views: __dirname + '/views'
    }
};
