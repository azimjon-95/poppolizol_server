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
      enum: ["kilo", "dona", "metr"],
      required: true,
    },
    quantity: {
      type: Number,
      min: 0,
      required: true,
    },
    currency: {
      type: String,
      enum: ["sum", "dollar"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    // supplier: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Customers",
    //   required: true,
    // },
  },
  { timestamps: true }
);

const Material = mongoose.model("materials", MaterialSchema);

module.exports = Material;
