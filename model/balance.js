const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
    naqt: {
        type: Number,
        default: 0,
        min: 0 // Balance cannot be negative
    },
    bank: {
        type: Number,
        default: 0,
        min: 0 // Balance cannot be negative
    },
}, {
    timestamps: true
});

// Initialize a single balance document if it doesn't exist
balanceSchema.statics.initializeBalance = async function (session = null) {
    const options = session ? { session } : {};
    const existingBalance = await this.findOne({}, {}, options);
    if (!existingBalance) {
        await this.create({ naqt: 0, bank: 0 }, options);
    }
};

// Update balance based on payment method, type, and amount
balanceSchema.statics.updateBalance = async function (paymentMethod, type, amount, session = null) {
    if (!['naqt', 'bank'].includes(paymentMethod)) {
        throw new Error(`Noto‘g‘ri to‘lov usuli: ${paymentMethod}`);
    }

    if (amount < 0) {
        throw new Error('To‘lov summasi manfiy bo‘lishi mumkin emas');
    }

    const update = type === 'kirim'
        ? { $inc: { [paymentMethod]: amount } }
        : { $inc: { [paymentMethod]: -amount } };

    const filter = type === 'chiqim'
        ? { [paymentMethod]: { $gte: amount } } // Ensure sufficient balance for chiqim
        : {};

    const options = {
        new: true,
        upsert: true, // Create document if it doesn't exist
        setDefaultsOnInsert: true,
        ...(session && { session }) // Include session if provided
    };

    const balance = await this.findOneAndUpdate(filter, {
        ...update,
        lastUpdated: new Date()
    }, options);

    if (!balance && type === 'chiqim') {
        throw new Error(`${paymentMethod}da yetarli mablag‘ yo‘q`);
    }

    return balance;
};

// Get the single balance document
balanceSchema.statics.getBalance = async function (session = null) {
    const options = session ? { session } : {};
    const balance = await this.findOne({}, {}, options);
    if (!balance) {
        throw new Error('Balans hujjati topilmadi');
    }
    return balance;
};

const Balance = mongoose.model('Balance', balanceSchema);
module.exports = Balance;





