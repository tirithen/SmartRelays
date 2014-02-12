var ip = require('ip'),
    async = require('async'),
    exec = require('child_process').exec,
    updateTimer,
    updateDelay = 10000;

module.exports.clients = {};

module.exports.updateAll = function () {
    var firstIp = ip.address().replace(/\d+$/, '255');

    clearTimeout(updateTimer);

    exec(
        'ping -b -c 1 ' + firstIp + ' && arp',
        { timeout: 2000 },
        function (error, output) {
            if (error || !output) {
                updateTimer = setTimeout(module.exports.updateAll, 1000);
            } else {
                module.exports.clients = {};
                output.split('\n').forEach(function (line) {
                    var matches;

                    if (line) {
                        matches = line.match(/((\d{1,3}\.){3}\d{1,3}).+?(([\da-f]{2}\:){5}[\da-f]{2})/i);
                        if (matches) {
                            module.exports.clients[matches[3]] = {
                                ip: matches[1],
                                mac: matches[3]
                            };                        
                        }
                    }
                });

                updateTimer = setTimeout(module.exports.updateAll, updateDelay);
            }
        }
    );
};

module.exports.updateAll();
