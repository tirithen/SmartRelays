var arp = require('node-arp'),
    ip = require('ip'),
    async = require('async'),
    spawn = require('child_process').spawn,
    updateTimer;

module.exports.clients = {};

module.exports.getMacByIp = function (ip, callback) {
    arp.getMAC(ip, callback);
};

module.exports.updateAll = function (callback) {
    var firstIp = ip.address().replace(/\d+$/, '1'),
        nmap = spawn("nmap", [ '-sP', firstIp + '/24' ]),
        buffer = '';

    clearTimeout(updateTimer);

    nmap.stdout.on('data', function (data) {
        buffer += data;
    });

	nmap.on('close', function (code) {
        module.exports.clients = {};
        async.eachLimit(
            buffer.split('\n'),
            5,
            function (line, next) {
                var matches = line.match(/(\d{1,3}\.){3}\d{1,3}/);

                if (matches && matches[0]) {
                    module.exports.getMacByIp(matches[0], function (error, mac) {
                        if (error) {
                            next(error);
                        } else {
                            module.exports.clients[mac] = {
                                ip: matches[0],
                                mac: mac
                            };

                            next(error);
                        }
                    });
                } else {
                    next();
                }
            },
            function (error) {
                if (callback instanceof Function) {
                    callback(error, module.exports.clients);
                }

                setTimeout(module.exports.updateAll, 20000);
            }
        );
	});
};

module.exports.updateAll();
