const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const materialValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      name: { type: "string", minLength: 2, maxLength: 50 },
      unit: {
        type: "string",
        enum: ["kilo", "dona", "metr"],
      },
      quantity: {
        type: "number",
        minimum: 0,
      },
      currency: {
        type: "string",
        enum: ["sum", "dollar"],
      },
      price: {
        type: "number",
        minimum: 0,
      },
    },
    required: ["name", "unit", "quantity", "currency", "price"],
    additionalProperties: false,
    errorMessage: {
      required: {
        name: "Material nomi kiritilishi shart",
        unit: "Material birligi kiritilishi shart",
        quantity: "Material miqdori kiritilishi shart",
        currency: "Valyuta turi kiritilishi shart",
        price: "Material narxi kiritilishi shart",
      },
      properties: {
        name: "Material nomi 2 dan 50 gacha belgidan iborat bo'lishi kerak",
        unit: "Material birligi 'kilo', 'dona' yoki 'metr' bo'lishi kerak",
        quantity: "Material miqdori musbat son bo'lishi kerak",
        currency: "Valyuta turi 'sum' yoki 'dollar' bo'lishi kerak",
        price: "Material narxi musbat son bo'lishi kerak",
      },
      additionalProperties: "Ruxsat etilmagan maydon kiritildi",
    },
  };

  const validate = ajv.compile(schema);
  const result = validate(req.body);

  if (!result) {
    const errorField =
      validate.errors[0].instancePath.replace("/", "") || "Umumiy";
    const errorMessage = validate.errors[0].message;
    return response.error(res, `${errorField} xato: ${errorMessage}`);
  }

  next();
};

module.exports = materialValidation;
