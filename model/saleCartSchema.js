const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
    date: { type: String, required: true, default: () => new Date().toLocaleDateString('uz-UZ') },
    time: { type: String, required: true, default: () => new Date().toLocaleTimeString('uz-UZ') },
    customer: {
        name: { type: String, default: '' },
        type: { type: String, enum: ['individual', 'company'], default: 'individual' },
        phone: { type: String, default: '' },
        companyName: { type: String, default: '' },
        companyAddress: { type: String, default: '' },
        taxId: { type: String, default: '' },
        company: { type: String, default: '' },
    },
    transport: { type: String, default: '' },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
        productName: { type: String, required: true },
        category: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        marketType: { type: String, default: 'tashqi' },
        productionCost: { type: Number, required: true },
        sellingPrice: { type: Number, required: true },
        discountedPrice: { type: Number, required: true },
        pricePerUnit: { type: Number, required: true },
        ndsRate: { type: Number, required: true },
        ndsAmount: { type: Number, required: true },
        productionDate: { type: Date, required: true },
        size: { type: String, default: 'dona' },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    }],
    payment: {
        totalAmount: { type: Number, required: true },
        paidAmount: { type: Number, default: 0 },
        debt: { type: Number, required: true },
        status: { type: String, enum: ['paid', 'partial'], default: 'partial' },
        paymentDescription: { type: String, default: '' },
        discountReason: { type: String, default: '' },
        paymentType: { type: String, enum: ['naqt', 'bank'], default: 'naqt' }, // New field for initial payment type
        paymentHistory: [{
            amount: { type: Number, required: true },
            date: { type: Date, default: Date.now },
            description: { type: String, default: '' },
            paidBy: { type: String, required: true },
            paymentType: { type: String, enum: ['naqt', 'bank'], required: true }, // New field for payment history
        }],
    },
    salesperson: { type: String, required: true },
    salerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    isContract: { type: Boolean, default: true },
    isDelivered: { type: Boolean, default: false },
    deliveryDate: { type: Date, default: null },
}, {
    timestamps: true,
});
const Salecart = mongoose.model('Salecart', saleSchema);

module.exports = Salecart;