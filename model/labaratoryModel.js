const { model, Schema } = require("mongoose");

const labaratorySchema = new Schema(
  {
    storyId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "stories",
    },
    results: [
      {
        key: { type: String },
        name: { type: String },
        price: { type: Number },
        extraPrice: { type: Number },
        analis: { type: String },
        norma: { type: String },
        siBirlik: { type: String },
        gl: { type: String },
        gr: { type: String },
        ml: { type: String },
        result: { type: String },
      },
    ],
    status: { type: String, enum: ["wait", "done"], default: "wait" },
  },
  {
    timestamps: true,
  }
);

module.exports = model("Labaratory", labaratorySchema);
