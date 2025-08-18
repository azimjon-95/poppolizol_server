const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    unit: { type: String, required: true },
    baseQty: { type: Number, required: true },
    baseQiymat: { type: Number, required: true },
    isMaterial: { type: Boolean, default: false },
    materialId: { type: String, default: null },
    removable: { type: Boolean, default: false }
});

const TotalsSchema = new mongoose.Schema({
    costAll: { type: Number, required: true },
    marginPerBucket: { type: Number, required: true },
    profitAll: { type: Number, required: true },
    saleAll: { type: Number, required: true },
    tannarxAll: { type: Number, required: true }
});

const PraymerSchema = new mongoose.Schema({
    productionName: { type: String, required: true },
    productionQuantity: { type: Number, required: true },
    profitPercent: { type: Number, required: true },
    salePricePerBucket: { type: Number, required: true },
    items: [ItemSchema],
    totals: TotalsSchema,
    createdAt: { type: Date, default: Date.now }
});

const Praymer = mongoose.model('Praymer', PraymerSchema);

module.exports = Praymer;