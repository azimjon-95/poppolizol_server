const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  relatedId: {
    type: String,
  },
  type: {
    type: String,
    required: true,
    enum: ['kirim', 'chiqim']
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['paymentMethod', 'naqt', 'bank']
  },
  category: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

const Expense = mongoose.model('Expense', expenseSchema);
module.exports = Expense;



