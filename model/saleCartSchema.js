const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ['individual', 'company'], default: 'individual' },
    phone: { type: String },
    companyAddress: { type: String },
    company: { type: String },
}, { timestamps: true });

const saleSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      default: () => new Date().toLocaleDateString("uz-UZ"),
    },
    time: {
      type: String,
      required: true,
      default: () => new Date().toLocaleTimeString("uz-UZ"),
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    items: [
      {
        productName: { type: String, required: true },
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FinishedProduct",
          required: true,
        },
        category: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        marketType: { type: String, default: "tashqi" },
        productionCost: { type: Number, required: true },
        sellingPrice: { type: Number, required: true },
        discountedPrice: { type: Number, required: true },
        pricePerUnit: { type: Number, required: true },
        ndsRate: { type: Number, required: true },
        ndsAmount: { type: Number, required: true },
        productionDate: { type: Date, required: true },
        size: { type: String, default: "dona" },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    deliveredItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "FinishedProduct",
          required: true,
        },
        productName: { type: String, required: true },
        deliveredQuantity: { type: Number, required: true, min: 1 },
        totalAmount: { type: Number, required: true },
        transport: { type: String, required: true },
        transportCost: { type: Number, required: true, min: 0 },
        deliveryDate: { type: Date, default: Date.now },
        deliveredGroup: { type: String, required: true },
      },
    ],
    payment: {
      totalAmount: { type: Number, required: true },
      paidAmount: { type: Number, default: 0 },
      debt: { type: Number, required: true },
      ndsTotal: { type: Number, required: true },
      status: { type: String, enum: ["paid", "partial"], default: "partial" },
      paymentDescription: { type: String, default: "" },
      discountReason: { type: String, default: "" },
      paymentType: { type: String, enum: ["naqt", "bank"], default: "naqt" },
      isActive: { type: Boolean, default: true },
      paymentHistory: [
        {
          amount: { type: Number, required: true },
          date: { type: Date, default: Date.now },
          description: { type: String, default: "" },
          paidBy: { type: String, required: true },
          paymentType: { type: String, enum: ["naqt", "bank"], required: true },
        },
      ],
    },
    salesperson: { type: String, required: true },
    salerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    isContract: { type: Boolean, default: true },
    customerType: { type: String, default: "internal" },
  },
  {
    timestamps: true,
  }
);

saleSchema.pre('save', function (next) {
    if (this.payment.debt === 0) {
        this.payment.isActive = false;
    }
    next();
});

const Salecart = mongoose.model('Salecart', saleSchema);
const Customer = mongoose.model('Customer', customerSchema);

module.exports = { Salecart, Customer };

