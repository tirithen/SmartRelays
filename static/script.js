$(function () {
    var relayWrapper = $('#relays'),
        socket = io.connect(),
        relays = {};

    function Relay(relayData) {
        this._id = relayData._id;
        this.name = relayData.name;
        this.unit = relayData.unit;
        this.remote = relayData.remote;
        this.status = relayData.status;
        this.autonomous = relayData.autonomous;

        this.createElements();
        this.bindElements();
        this.updateElements();
    }

    Relay.prototype.update = function (data) {
        var key = '';

        for(key in data) {
            if (data.hasOwnProperty(key)) {
                this[key] = data[key];
            }
        }
    };

    Relay.prototype.createElements = function () {
        this.relayElement = $(
            '<div class="relay panel panel-default">' +
                '<div class="panel-body">' +
                    '<h2 class="name"></h2> ' +
                    '<div class="pull-right">' +
                        '<button type="button" class="button-toggle" data-toggle="button">' +
                            '<i class="glyphicon glyphicon-off"></i>' +
                        '</button>' +
                        '<button type="button" class="button-switch" data-toggle="button"><i></i><span>Smart</span></button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        ).appendTo(relayWrapper);
        this.nameElement = this.relayElement.find('.name');
        this.statusButtonElement = this.relayElement.find('.button-toggle');
        this.autonomousButtonElement = this.relayElement.find('.button-switch');
    };

    Relay.prototype.bindElements = function () {
        var self = this;

        this.statusButtonElement.on('click', function () {
            if (self.status) {
                self.status = 0;
            } else {
                self.status = 1;
            }

            self.updateElements();
            self.sync();
        });

        this.autonomousButtonElement.on('click', function () {
            if (self.autonomous) {
                self.autonomous = false;
            } else {
                self.autonomous = true;
            }

            self.updateElements();
            self.sync();
        });
    };

    Relay.prototype.updateElements = function () {
        if (this.name !== this.nameElement.text()) {
            this.nameElement.text(this.name);
        }

        if (this.status) {
            this.statusButtonElement.addClass('active');
        } else {
            this.statusButtonElement.removeClass('active');
        }

        if (this.autonomous) {
            this.autonomousButtonElement.addClass('active');
        } else {
            this.autonomousButtonElement.removeClass('active');
        }
    };

    Relay.prototype.sync = function () {
        socket.emit('relay update', {
            _id: this._id,
            name: this.name,
            unit: this.unit,
            remote: this.remote,
            status: this.status,
            autonomous: this.autonomous
        });
    };

    $('form#addRelay').on('submit', function (event) {
        var form = $(event.target),
            data = {
                name: form.find('input[name="name"]').val(),
                unit: form.find('input[name="unit"]').val(),
                remote: form.find('input[name="remote"]').val()
            };

        event.preventDefault();
        socket.emit('relay add', data);
        form.get(0).reset();
    });

    $('form#addMacAddress').on('submit', function (event) {
        var form = $(event.target),
            data = {
                mac: form.find('input[name="mac"]').val()
            };

        event.preventDefault();
        socket.emit('mac add', data);
        form.get(0).reset();
    });

    socket.on('relays', function (relaysData) {
        relaysData.forEach(function (relayData) {
            if (relays[relayData._id]) {
                relays[relayData._id].update(relayData);
            } else {
                relays[relayData._id] = new Relay(relayData);
            }

            relays[relayData._id].updateElements();
        });
    });

    socket.on('macs', function (macsData) {
        var macListElement = $('form#addMacAddress ul.list-group'),
            macFieldElement = $('form#addMacAddress input[name="mac"]');

        if (macsData.length > 0) {
            macListElement.empty();
            macsData.forEach(function (macData) {
                var macElement = $('<li class="list-group-item">' + macData.mac + '</li>');

                if (macData.online) {
                    $('<small class="text-muted"><em> - ' + macData.ip + '</em></small> <span class="label">Online</span>').appendTo(macElement);
                }

                if (macData.mac === macFieldElement.val()) {
                    macFieldElement.val('');
                }

                macElement.appendTo(macListElement);
            });
        }
    });
});
