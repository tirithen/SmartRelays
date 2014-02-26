module.exports = function (mongoose) {
    var schema = new mongoose.Schema({
            mac: {
                type: String,
                required: true,
                unique: true,
                validate: /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/,
                set: function (value) {
                    return value.toLowerCase()
                }
            },
            createdAt: { type: Date, 'default': Date.now },
            updatedAt: { type: Date, 'default': Date.now }
        }),
        model;

    schema.pre('save', function (next) {
        this.updatedAt = new Date();
        next();
    });

    model = mongoose.model('Mac', schema);

    return model;
};
