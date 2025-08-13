const mongoose = require("mongoose");

const IncomeSchema = new mongoose.Schema(
  {
    firm: {
      type: {
        name: { type: String, required: true },
        phone: { type: String },
        address: { type: String },
      },
      required: true,
    },
    firmId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Firm"
    },
    materials: [
      {
        category: { type: String },
        currency: { type: String },
        name: { type: String },
        price: { type: Number },
        quantity: { type: Number },
        transportCostPerUnit: { type: Number },
        unit: { type: String },
        workerCostPerUnit: { type: Number },
      },
    ],
    price: { type: Number, default: 0 },
    paymentType: { type: String },
    vatPercentage: { type: Number },
    totalTransportCost: { type: Number },
    totalWithVat: { type: Number },
    totalWithoutVat: { type: Number },
    totalWorkerCost: { type: Number },
    vatAmount: { type: Number },
    workerPayments: [
      {
        payment: { type: Number },
        workerId: { type: mongoose.Schema.Types.ObjectId, ref: "Admins" },
      },
    ],

    debt: {
      initialAmount: { type: Number, default: 0 },
      remainingAmount: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ["pending", "partially_paid", "fully_paid"],
        default: "pending",
      },
      debtPayments: [
        {
          amount: { type: Number, required: true },
          paymentDate: { type: Date, default: Date.now },
          paymentMethod: {
            type: String,
            enum: ["naqt", "bank"],
            required: true,
          },
          note: { type: String },
        },
      ],
    },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Income = mongoose.model("Income", IncomeSchema);
module.exports = Income;


