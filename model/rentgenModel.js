const { model, Schema } = require("mongoose");

const rentgenSchema = new Schema(
  {
    storyId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "stories",
    },
    imgUrl: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = model("Rentgen", rentgenSchema);
