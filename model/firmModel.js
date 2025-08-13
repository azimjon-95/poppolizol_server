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
    debt: {
        type: Number,
        default: 0 // Qarzdorlik manfiy bo'lsa, kompaniya firmaga qarzdor; musbat bo'lsa, firma kompaniyaga qarzdor
    },
}, { timestamps: true });

// Static method to check debt status in real-time
FirmSchema.statics.checkDebtStatus = async function (firmId) {
    try {
        const firm = await this.findById(firmId);
        if (!firm) {
            throw new Error("Firma topilmadi");
        }
        // Return true if debt is negative (company owes firm), false if positive or zero (firm owes company or no debt)
        return firm.debt < 0;
    } catch (error) {
        throw new Error(`Xatolik yuz berdi: ${error.message}`);
    }
};

const Firm = mongoose.model("Firm", FirmSchema);
module.exports = Firm;


