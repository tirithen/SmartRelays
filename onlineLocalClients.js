var ip = require('ip'),
    async = require('async'),
    exec = require('child_process').exec,
    updateTimer,
    updateDelay = 10000;

module.exports.clients = {};

module.exports.getMacByIp = function (ip) {
    var key = '',
        mac,
        clients = module.exports.clients;

    for (key in clients) {
        if (
            clients.hasOwnProperty(key) &&
            ip === clients[key].ip
        ) {
            mac = module.exports.clients[key].mac;
            break;
        }
    }

    return mac;
};

module.exports.updateAll = function () {
    var broadcastIp = ip.address().replace(/\d+$/, '');

    clearTimeout(updateTimer);

    exec(
        'nmap -sP ' + broadcastIp + '0/24 && ' +
        'ping -b -c 1 ' + broadcastIp + '1 && ' +
        'ping -b -c 1 ' + broadcastIp + '255 && ' +
        'arp -na',
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
