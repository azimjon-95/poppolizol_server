// debtSchema.js
const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['lend', 'borrow'] // 'lend' - company lent money, 'borrow' - company borrowed money
    },
    counterparty: {
        type: String,
        required: true, // Name or ID of the person/company involved
        trim: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0 // Debt amount cannot be negative
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['naqt', 'bank']
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        required: true,
        enum: ['active', 'repaid'],
        default: 'active'
    },
    dueDate: {
        type: Date,
        required: true
    },
    remainingAmount: {
        type: Number,
        required: true,
        min: 0,
        default: function () {
            return this.amount;
        }
    }
}, {
    timestamps: true
});

// Record a new debt (lend or borrow)
debtSchema.statics.createDebt = async function (debtData, session = null) {
    const { type, amount, paymentMethod } = debtData;
    const options = session ? { session } : {};

    // Update balance based on debt type
    if (type === 'lend') {
        // When lending, decrease company balance
        await require('./balance').updateBalance(paymentMethod, 'chiqim', amount, session);
    } else if (type === 'borrow') {
        // When borrowing, increase company balance
        await require('./balance').updateBalance(paymentMethod, 'kirim', amount, session);
    }

    // Create corresponding expense record
    const expenseData = {
        type: type === 'lend' ? 'chiqim' : 'kirim',
        paymentMethod,
        category: type === "lend" ? "Qar berildi" : "Qar olindi",
        amount,
        description: debtData.description,
        date: new Date(),
        relatedId: null // Will be updated after debt creation
    };

    const debt = await this.create([debtData], options);
    expenseData.relatedId = debt[0]._id;

    // Create expense record
    await require('./expenseModel').create([expenseData], options);

    return debt[0];
};

// Record debt repayment
debtSchema.statics.repayDebt = async function (debtId, amount, paymentMethod, session = null) {
    const options = session ? { session } : {};

    const debt = await this.findById(debtId, {}, options);
    if (!debt) {
        throw new Error('Qarz topilmadi');
    }
    if (debt.status === 'repaid') {
        throw new Error('Bu qarz allaqachon to‘langan');
    }
    if (amount <= 0) {
        throw new Error('To‘lov summasi musbat bo‘lishi kerak');
    }
    if (amount > debt.remainingAmount) {
        throw new Error('To‘lov summasi qoldiq summadan oshib ketdi');
    }

    // Update balance based on debt type
    if (debt.type === 'lend') {
        // When receiving repayment for lent money, increase balance
        await require('./balance').updateBalance(paymentMethod, 'kirim', amount, session);
    } else if (debt.type === 'borrow') {
        // When repaying borrowed money, decrease balance
        await require('./balance').updateBalance(paymentMethod, 'chiqim', amount, session);
    }

    // Update debt
    const newRemaining = debt.remainingAmount - amount;
    const update = {
        remainingAmount: newRemaining,
        status: newRemaining === 0 ? 'repaid' : 'active'
    };

    // Create expense record for repayment
    const expenseData = {
        type: debt.type === 'lend' ? 'kirim' : 'chiqim',
        paymentMethod,
        category: `Qarz to'lovi`,
        amount,
        description: `Kirim material uchun qarz to'lovi`,
        date: new Date(),
        relatedId: debtId
    };

    await require('./expenseModel').create([expenseData], options);
    return await this.findByIdAndUpdate(debtId, update, { ...options, new: true });
};

// Get active debts
debtSchema.statics.getActiveDebts = async function (type = null, session = null) {
    const query = { status: 'active' };
    if (type) query.type = type;
    const options = session ? { session } : {};
    return await this.find(query, {}, options);
};

// Get debt history
debtSchema.statics.getDebtHistory = async function (type = null, session = null) {
    const query = type ? { type } : {};
    const options = session ? { session } : {};
    return await this.find(query, {}, options);
};

const Debt = mongoose.model('Debt', debtSchema);
module.exports = Debt;

