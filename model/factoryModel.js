const mongoose = require('mongoose');

const factorySchema = new mongoose.Schema({
  factoryName: { type: String, required: true },
  location: { type: String, required: true },
  capacity: { type: String, required: true },
  phone: { type: [String], required: true },
  workingHours: {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  },
  electricityPrice: { type: Number, required: true },
  methaneGasPrice: { type: Number, required: true },

  telegramApiUrl: {
    botToken: { type: String, required: true },
    chatId: { type: String, required: true }
  },
  nds: { type: Number, required: true },
  bitumenMarkFive: {
    costPrice: { type: Number, required: true },
    profitMargin: { type: Number, required: true }
  },
  ruberoidBlackPaper: {
    costPrice: { type: Number, required: true },
    profitMargin: { type: Number, required: true }
  },
  otherInfo: { type: String },
  createdAt: { type: Date, default: Date.now }
});



// ===================productSchema========================

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true // nomlar unikal bo'lishi kerak
  },
  category: {
    type: String,
    enum: ['Polizol', 'Folygoizol', 'Ruberoid'],
    required: true
  },
  productionCost: {
    type: Number,
    required: true
  },
  loadingCost: {
    type: Number,
    required: true
  }
}, { timestamps: true });

// ===================WorkerExpenses========================

const workerExpensesSchema = new mongoose.Schema({
  saturdayWage: {
    type: Number,
    required: true,
  },
  periodicExpenses: {
    type: Number,
    required: true,
  },
  additionalExpenses: {
    type: Number,
    required: true,
  }
}, {
  timestamps: true,
});

const Product = mongoose.model('Product', productSchema);
const Factory = mongoose.model('Factory', factorySchema);
const AdditionExpen = mongoose.model('AdditionalExpenses', workerExpensesSchema);

module.exports = { Product, Factory, AdditionExpen };