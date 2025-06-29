const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['individual', 'company'], required: true },
    phone: { type: String, trim: true },
    companyName: { type: String, trim: true },
    companyAddress: { type: String, trim: true },
    taxId: { type: String, trim: true }
}, { _id: false });

const itemSchema = new mongoose.Schema({
    type: { type: String, enum: ['coal_paper', 'betum'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    pricePerUnit: { type: Number, min: 0 },
    pricePerKg: { type: Number, min: 0 },
    discountedPrice: { type: Number, min: 0 }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0 },
    debt: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['paid', 'partial'], required: true },
    paymentDescription: { type: String, trim: true }
}, { _id: false });

const saleSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    customer: { type: customerSchema, required: true },
    items: { type: [itemSchema], required: true, validate: v => Array.isArray(v) && v.length > 0 },
    payment: { type: paymentSchema, required: true },
    salesperson: { type: String, required: true, trim: true },
    salespersonId: { type: mongoose.Schema.Types.ObjectId, required: true },
    totalWeight: { type: Number, required: true, min: 0 },
    totalPoddons: { type: Number, required: true, min: 0 },
    isContract: { type: Boolean, required: true, default: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for common queries
saleSchema.index({ date: 1 });
saleSchema.index({ salespersonId: 1 });
saleSchema.index({ 'customer.name': 1 });

module.exports = mongoose.model('Sale', saleSchema);