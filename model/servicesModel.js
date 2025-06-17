const mongoose = require('mongoose');

const servicesSchema = new mongoose.Schema({
    profession: {
        type: String,
        required: true,
        trim: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admins",
    },
    services: [{
        _id: false, // Disable _id for subdocuments
        name: {
            type: String,
            required: true,
            trim: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        }
    }],
}, { timestamps: true });

const Services = mongoose.model('Services', servicesSchema);

module.exports = Services;


