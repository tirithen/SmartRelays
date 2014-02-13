var nn = require('simple-fann'),
    configuration = require('./configuration'),
    http = require('http'),
    async = require('async'),
    io = require('socket.io'),
    ip = require('ip'),
    schedule = require('node-schedule'),
    models = require('./models').initialize(configuration),
    SmartRelayCase = require('./SmartRelayCase'),
    webServer = require('./webServer'),
    onlineLocalClients = require('./onlineLocalClients'),
    arduino = require('./smartRelaysArduino')(),
    socketServer,
    relayTimer,
    macTimer,
    macOnlineCount = 0,
    clientSyncDelay = 20000,
    trainingOfNetworksRunning = false;

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function sendRadioSignal(relay, callback) {
    var signal;

    if (arduino && arduino.port) {
        console.log('Sending radio signal command to Arduino.');
        signal = relay.unit - 1;

        signal += 1 << 5;
        if (!relay.status) {
            signal += 1 << 4;
        }
        signal += relay.remote << 6;

        arduino.port.write(
            'p' + pad(signal.toString(16), 8) + '\n',
            function () {
                setTimeout(callback, 100);
            }
        );
    } else {
        console.warn('No Arduino connected, not sending anything.');
        callback();
    }
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
                    } else {
                        next();
                    }
                },
                function () {
                    socketServer.sockets.emit('relays', relays);
                    relayTimer = setTimeout(updateRelays, clientSyncDelay);
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
        macTimer = setTimeout(updateMacs, clientSyncDelay);
    });
}

function trainNetworks() {
    var models = [];

    if (!trainingOfNetworksRunning) {
        trainingOfNetworksRunning = true;

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
                trainingOfNetworksRunning = false;
            }
        );
    }
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
        }
    ],
    function (errors) {
        if (errors) {
            throw errors;
        }

        webServer.get('/', function (request, response) {
            var ip = (request.headers['x-forwarded-for'] || '').split(',')[0] || request.connection.remoteAddress,
                mac = onlineLocalClients.getMacByIp(ip);
            response.render('index', { mac: mac || '' });
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
                    var key = '',
                        trainCase,
                        statusWasChanged = false;

                    if (error) {
                        throw error;
                    }

                    if (relay.status !== data.status) {
                        statusWasChanged = true;
                    }

                    for(key in data) {
                        if (data.hasOwnProperty(key)) {
                            relay[key] = data[key];
                        }
                    }

                    if (statusWasChanged) {
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

                    sendRadioSignal(relay, function () {});

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

        schedule.scheduleJob({ hour: 2, minute: 0 }, trainNetworks);

        console.log('SmartRelays server is up and running on port http://' + ip.address() + ':' + configuration.port);
    }
);
