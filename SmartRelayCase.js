function SmartRelayCase(options) {
    this.date = options.date instanceof Date ? options.date : new Date();

    this.weekday = this.date.getDay() / 6;
    this.month = this.date.getUTCMonth() / 11;
    this.year = (this.date.getUTCFullYear() - 2000) / 3000;
    this.timeOfDay = (this.date.getUTCHours() * 3600 +
    this.date.getUTCMinutes() * 60 +
    this.date.getUTCSeconds()) / (3600 * 24);

    this.someOneIsHome = options.someOneIsHome || 0;

    this.input = [
        this.weekday,
        this.month,
        this.year,
        this.timeOfDay,
        this.someOneIsHome
    ];

    this.output = options.output;
    if (!Array.isArray(this.output)) {
        this.output = [ this.output ];
    }

    this.trainingData = [this.input, [this.output]];
}

module.exports = SmartRelayCase;
