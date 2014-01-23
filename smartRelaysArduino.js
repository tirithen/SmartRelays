var serialPort = require('serialport'),
    async = require('async'),
    retryDelay = 10000,
    service = {};

function findArduino() {
    var arduinoPort,
        FOUND_CODE = 'ArduinoFound';

	serialPort.list(function (error, ports) {
		async.each(
			ports,
			function (port, next) {
				var arduinoPortCandidate,
					timer,
					nextCalled = false;

				function callNext(code) {
					clearTimeout(timer);

					if (nextCalled === false) {
						nextCalled = true;

						if (code !== FOUND_CODE) {
							arduinoPortCandidate.close();
						}

						next(code);
					}
				}

				if (arduinoPort) {
					next();
				} else if (port.comName.match(/^\/dev\/tty/)) { // If potential Arduino serial port
					arduinoPortCandidate = new serialPort.SerialPort(
						port.comName,
						{ baudrate: 115200 }
					);

					arduinoPortCandidate.on('data', function (data) {
						if (data.toString().match(/SmartRelay/)) {
							arduinoPort = arduinoPortCandidate;
							callNext(FOUND_CODE);
						} else {
							callNext();
						}
					});

					arduinoPortCandidate.on('error', function () {
						callNext();
					});

					timer = setTimeout(function () {
						callNext();
					}, 2000);
				}
			},
			function (code) {
				var error;

				if (code !== FOUND_CODE) {
					error = new Error(
						'No Arduino with SmartRelay firmware running, please make sure that you have ' +
						'the Arduino device with proper firmware connected the the server.'
					);
					console.error(error.message);
				}

				service.port = arduinoPort;
				service.error = error;

				if (arduinoPort) {
					arduinoPort.on('close', function () {
						service.port = null;
					});

					arduinoPort.on('error', function () {
						service.port = null;
					});
				}
			}
		);
	});
}

module.exports = function () {
	setInterval(function () {
	    if (!service.port) {
    		findArduino();
    	}
	}, retryDelay);

    return service;
};
