const mongoose = require("mongoose");

const factorySchema = new mongoose.Schema({
  factoryName: { type: String, required: true },
  location: { type: String, required: true },
  phone: { type: [String], required: true },
  workingHours: {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  electricityPrice: { type: Number, required: true },
  methaneGasPrice: { type: Number, required: true },
  telegramApiUrl: {
    botToken: { type: String, required: true },
    chatId: { type: String, required: true },
  },
  nds: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

// ===================productSchema========================

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // nomlar unikal bo'lishi kerak
    },
    category: {
      type: String,
      enum: [
        "Polizol",
        "Folygoizol",
        "Ruberoid",
        "bn-5",
        "bn-5 + mel",
        "bn-3",
        "praymer",
      ],
      required: true,
    },
    productionCost: {
      type: Number,
      default: 0,
    },
    loadingCost: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ===================WorkerExpenses========================

const workerExpensesSchema = new mongoose.Schema(
  {
    saturdayWage: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);
const Factory = mongoose.model("Factory", factorySchema);
const AdditionExpen = mongoose.model(
  "AdditionalExpenses",
  workerExpensesSchema
);

module.exports = { Product, Factory, AdditionExpen };
