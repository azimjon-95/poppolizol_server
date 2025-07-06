const mongoose = require("mongoose");

const MaterialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    unit: {
      type: String,
      enum: ["kilo", "dona", "metr", "litr", "gram"],
      required: true,
    },
    quantity: {
      type: Number,
      min: 0,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      trim: true,
      default: "Others"
    }
  },
  { timestamps: true }
);

const Material = mongoose.model("materials", MaterialSchema);

module.exports = Material;


