// transport
const mongoose = require("mongoose");

const transportSchema = new mongoose.Schema({
    transport: {
        type: String,
        required: true,
    },
    balance: {
        type: Number,
        default: 0
    },
}, { timestamps: true });

module.exports = mongoose.model("Transport", transportSchema);