var serialPort = require('serialport'),
    async = require('async');

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
                    code === FOUND_CODE ? null : new Error('No Arduino with SmartRelay sketch running'),
                    arduino
                );
            }
        );
    });
}

module.exports = function (callback) {
    findArduino(callback);
};
