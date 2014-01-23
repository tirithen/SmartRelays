var serialPort = require('serialport'),
    async = require('async'),
    retryDelay = 10000;

// TODO: Add automatic reconnect

function findArduino(callback) {
    var arduino,
        FOUND_CODE = 'ArduinoFound';

    serialPort.list(function (error, ports) {
        async.each(
            ports,
            function (port, next) {
                var arduinoCandidate,
                    timer,
                    nextCalled = false;

                function callNext(code) {
                    clearTimeout(timer);

                    if (nextCalled === false) {
                        nextCalled = true;

                        if (code !== FOUND_CODE) {
                            arduinoCandidate.close();
                        }

                        next(code);
                    }
                }

                if (arduino) {
                    next();
                } else if (port.comName.match(/^\/dev\/tty/)) { // If potential Arduino serial port
                    arduinoCandidate = new serialPort.SerialPort(
                        port.comName,
                        { baudrate: 115200 }
                    );

                    arduinoCandidate.on('data', function (data) {
                        if (data.toString().match(/SmartRelay/)) {
                            arduino = arduinoCandidate;
                            callNext(FOUND_CODE);
                        } else {
                            callNext();
                        }
                    });

                    arduinoCandidate.on('error', function () {
                        callNext();
                    });

                    timer = setTimeout(function () {
                        callNext();
                    }, 2000);
                }
            },
            function (code) {
                callback(
                    code === FOUND_CODE ? null : new Error(
                        'No Arduino with SmartRelay firmware running, please make sure that you have ' +
                        'the Arduino device with proper firmware connected the the server.'
                    ),
                    arduino
                );
            }
        );
    });
}

module.exports = function (callback) {
    var arduino = {};

    findArduino(function (error, port) {
        if (error) {
            console.error(error.message);
            console.log('Retrying Arduino detection in ' + Math.round(retryDelay / 1000) + ' seconds.');
            setTimeout(function () {
                findArduino(callback);
            }, retryDelay);
        }

        arduino.port = port;

        if (callback instanceof Function) {
            callback(error, port);
        }
    });

    return arduino;
};
