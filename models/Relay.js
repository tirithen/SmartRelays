module.exports = function (mongoose) {
    var schema = new mongoose.Schema({
            name: { type: String, required: true, unique: true },
            unit: { type: Number, required: true, 'default': 0, validate: /^[123]$/ },
            remote: { type: Number, required: true },
            status: { type: Number, required: true, 'default': 0 },
            autonomous: { type: Boolean, required: true, 'default': false },
            createdAt: { type: Date, 'default': Date.now },
            updatedAt: { type: Date, 'default': Date.now }
        }),
        model;

    schema.pre('save', function (next) {
        this.updatedAt = new Date();
        next();
    });

    model = mongoose.model('Relay', schema);

    return model;
};
