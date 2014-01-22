var nn = require('simple-fann'),
    configuration = require('./configuration'),
    http = require('http'),
    async = require('async'),
    io = require('socket.io'),
    models = require('./models').initialize(configuration),
    SmartRelayCase = require('./SmartRelayCase'),
    webServer = require('./webServer'),
    onlineLocalClients = require('./onlineLocalClients'),
    arduino = require('./smartRelaysArduino'),
    socketServer,
    relayTimer,
    macTimer,
    trainTimer,
    macOnlineCount = 0;

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function sendRadioSignal(relay, callback) {
    var signal = relay.unit - 1;

    signal += 1 << 5;
    if (!relay.status) {
        signal += 1 << 4;
    }
    signal += relay.remote << 6;

    arduino.write(
        'p' + pad(signal.toString(16), 8) + '\n',
        function () {
            setTimeout(callback, 100);
        }
    );
}

function updateRelays() {
    clearTimeout(relayTimer);
    models.Relay.find({}, function (error, relays) {
        if (error) {
            throw error;
        }

        nn.loadModels(function (error) {
            if (error) {
                throw error;
            }

            async.eachSeries(
                relays,
                function (relay, next) {
                    var result;

                    if (
                        relay.autonomous &&
                        nn.models[relay._id] &&
                        nn.models[relay._id].neuralNetwork
                    ) {
                        result = nn.models[relay._id].run(new SmartRelayCase({
                            date: new Date(),
                            someOneIsHome: macOnlineCount > 0 ? 1 : 0
                        }).input) > 0.5 ? 1 : 0;

                        if (relay.status !== result) {
                            relay.status = result;
                            relay.save();
                        }

                        sendRadioSignal(relay, next);
                        next();
                    } else {
                        next();
                    }
                },
                function () {
                    socketServer.sockets.emit('relays', relays);
                    relayTimer = setTimeout(updateRelays, 20000);
                }
            );
        });
    });
}

function updateMacs() {
    clearTimeout(macTimer);
    models.Mac.find({}, function (error, macs) {
        if (error) {
            throw error;
        }

        macOnlineCount = 0;
        macs = macs.map(function (data) {
            var mac = { mac: data.mac };

            if (onlineLocalClients.clients[mac.mac]) {
                macOnlineCount += 1;
                mac.online = true;
                mac.ip = onlineLocalClients.clients[mac.mac].ip;
            }

            return mac;
        });

        socketServer.sockets.emit('macs', macs);
        macTimer = setTimeout(updateMacs, 5000);
    });
}

function trainNetworks() {
    var models = [];

    clearTimeout(trainTimer);

    for (modelName in nn.models) {
        if (nn.models.hasOwnProperty(modelName)) {
            models.push(nn.models[modelName]);
        }
    }

    async.eachSeries(
        models,
        function (model, next) {
            model.train(next);
        },
        function (error) {
            models = null;
            trainTimer = setTimeout(trainNetworks, 3600 * 1000);
        }
    );
}

async.parallel(
    [
        function (callback) {
            nn = nn(configuration.databaseConnectionString, callback);
        },
        function (callback) {
            webServer(configuration, function (server) {
                webServer = server;
                callback();
            });
        },
        function (callback) {
            arduino(callback);
        }
    ],
    function (errors, results) {
        arduino = results[2];

        if (errors) {
            throw errors;
        }

        webServer.get('/', function (request, response) {
            var ip = (request.headers['x-forwarded-for'] || '').split(',')[0] || request.connection.remoteAddress;
            onlineLocalClients.getMacByIp(ip, function (error, mac) {
                response.render('index', { mac: mac || '' });
            });
        });

        socketServer = io.listen(
            http.createServer(webServer).listen(configuration.port),
            { log: false }
        );
        socketServer.set('transports', ['websocket']); // For now, only support web sockets

        socketServer.on('connection', function (socket) {
            updateRelays();
            updateMacs();

            socket.on('relay add', function (data) {
                // TODO: add validation
                relay = new models.Relay(data);
                relay.save(function (error) {
                    if (error) {
                        throw error;
                    }

                    nn.addModel({
                        name: relay._id,
                        layers: [5, 20, 1],
                        error: 0.0001,
                        epochs: 100000
                    });

                    updateRelays();
                });
            });

            socket.on('relay update', function (data) {
                // TODO: add validation
                models.Relay.findById(data._id, function (error, relay) {
                    var key = '', trainCase;

                    if (error) {
                        throw error;
                    }

                    for(key in data) {
                        if (data.hasOwnProperty(key)) {
                            relay[key] = data[key];
                        }
                    }

                    if (relay.autonomous) {
                        trainCase = new SmartRelayCase({
                            date: new Date(),
                            someOneIsHome: macOnlineCount > 0 ? 1 : 0,
                            output: relay.status
                        });

                        nn.models[relay._id].addTrainingData(
                            trainCase.input,
                            trainCase.output,
                            {
                                date: trainCase.date,
                                someOneIsHome: trainCase.someOneIsHome
                            }
                        );
                    }

                    sendRadioSignal(relay);

                    relay.save(function (error) {
                        if (error) {
                            throw error;
                        }

                        updateRelays();
                    });
                });
            });

            socket.on('mac add', function (data) {
                // TODO: add validation
                models.Mac.findOne({ mac: data.mac }, function (error, mac) {
                    if (error) {
                        throw error;
                    }

                    if (!mac) {
                        mac = new models.Mac(data);
                        mac.save(function (error) {
                            if (error) {
                                throw error;
                            }

                            updateMacs();
                        });
                    }
                });
            });
        });

        updateRelays();
        updateMacs();
        trainNetworks();
    }
);
