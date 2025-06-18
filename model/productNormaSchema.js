const mongoose = require("mongoose");

const MaterialRequirementSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "materials", // Reference to Material model
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0, // Quantity cannot be less than 0
  },
});

// Main schema for product norms
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
    materials: [MaterialRequirementSchema], // Materials and their quantities
    description: {
      type: String,
    },
    size: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const ProductNorma = mongoose.model("productNorma", ProductNormaSchema);

module.exports = ProductNorma;
