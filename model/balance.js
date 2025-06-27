const mongoose = require('mongoose');

const balanceSchema = new mongoose.Schema({
    cash: {
        type: Number,
        default: 0,
        min: 0 // Balance cannot be negative
    },
    bankTransfer: {
        type: Number,
        default: 0,
        min: 0 // Balance cannot be negative
    },
    dollarTransfer: {
        type: Number,
        default: 0,
        min: 0 // Balance cannot be negative
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Initialize a single balance document if it doesn't exist
balanceSchema.statics.initializeBalance = async function () {
    const existingBalance = await this.findOne();
    if (!existingBalance) {
        await this.create({
            cash: 0,
            bankTransfer: 0,
            dollarTransfer: 0
        });
    }
};

// Update balance based on payment method, type, and amount
balanceSchema.statics.updateBalance = async function (paymentMethod, type, amount) {
    if (!['cash', 'bankTransfer', 'dollarTransfer'].includes(paymentMethod)) {
        throw new Error(`Invalid payment method: ${paymentMethod}`);
    }

    const balance = await this.findOne();
    if (!balance) {
        throw new Error('Balance document not found');
    }

    if (type === 'kirim') {
        balance[paymentMethod] += amount;
    } else if (type === 'chiqim') {
        if (balance[paymentMethod] < amount) {
            throw new Error(`Insufficient balance in ${paymentMethod}`);
        }
        balance[paymentMethod] -= amount;
    }

    balance.lastUpdated = new Date();
    await balance.save();
    return balance;
};

// Get the single balance document
balanceSchema.statics.getBalance = async function () {
    const balance = await this.findOne();
    if (!balance) {
        throw new Error('Balance document not found');
    }
    return balance;
};

const Balance = mongoose.model('Balance', balanceSchema);
module.exports = Balance;