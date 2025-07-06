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

module.exports = mongoose.model('Factory', factorySchema);


