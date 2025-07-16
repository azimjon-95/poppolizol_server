const mongoose = require("mongoose");

const MaterialRequirementSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "materials",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
});

const ProductNormaSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    materials: [MaterialRequirementSchema],
    salePrice: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    description: {
      type: String,
    },
    cost: {
      gasPerUnit: {
        type: Number,
        required: true,
        min: 0,
      },
      electricityPerUnit: {
        type: Number,
        required: true,
        min: 0,
      },
      laborCost: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      otherExpenses: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
      },
      totalCost: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

const ProductNorma = mongoose.model("productNorma", ProductNormaSchema);

module.exports = ProductNorma;