const mongoose = require("mongoose");

const FirmSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    contactPerson: {
        type: String,
        trim: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    address: {
        type: String,
        trim: true,
    },
}, { timestamps: true });

const Firm = mongoose.model("Firm", FirmSchema);
module.exports = Firm;
