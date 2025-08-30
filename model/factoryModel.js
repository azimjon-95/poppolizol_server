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
    name: { type: String, required: true, unique: true }, // nom unikal
    category: {
      type: String,
      enum: [
        "Polizol",
        "Folygoizol",
        "Ruberoid",
        "Bn_5",
        "Bn_5_mel",
        "Bn_3",
        "Praymer",
        "Qop",
        "Stakan",
      ],
      required: true,
    },
    productionCost: { type: Number, default: 0 }, // Ishlab chiqarish
    loadingCost: { type: Number, default: 0 }, // Yuklash / tushirish
    takeDownCost: { type: Number, default: 0 }, // Alohida kerak bo‘lsa
    qozongaTashlash: { type: Number, default: 0 }, // Qozonga tashlash
  },
  { timestamps: true }
);

// Qo'shimcha: salomat bo‘lishi uchun minimal validatsiya
productSchema.path("productionCost").get((v) => v ?? 0);
productSchema.path("loadingCost").get((v) => v ?? 0);
productSchema.path("takeDownCost").get((v) => v ?? 0);
productSchema.path("qozongaTashlash").get((v) => v ?? 0);

productSchema.set("toJSON", { getters: true });

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
