const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true, coerceTypes: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const normaValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      productName: {
        type: "string",
        minLength: 1,
        maxLength: 100,
      },
      category: {
        type: "string",
        minLength: 1,
        maxLength: 255,
      },
      salePrice: {
        type: "number",
        minimum: 0,
      },
      materials: {
        type: "array",
        items: {
          type: "object",
          properties: {
            materialId: {
              type: "string",
              pattern: "^[0-9a-fA-F]{24}$",
            },
            quantity: {
              type: "number",
              minimum: 0,
            },
          },
          required: ["materialId", "quantity"],
          additionalProperties: false,
          errorMessage: {
            type: "Material ob'ekti noto'g'ri formatda",
            required: {
              materialId: "Material ID kiritilishi shart",
              quantity: "Miqdor kiritilishi shart",
            },
            properties: {
              materialId: "Material ID 24 ta belgidan iborat bo'lishi kerak",
              quantity: "Miqdor 0 dan kichik bo'lmasligi kerak",
            },
            additionalProperties: "Material uchun ruxsat etilmagan maydon kiritildi",
          },
        },
      },
      description: {
        type: "string",
      },
    },
    required: ["productName", "category", "materials", "salePrice"],
    additionalProperties: false,
    errorMessage: {
      required: {
        productName: "Mahsulot nomi kiritilishi shart",
        category: "Mahsulot turi kiritilishi shart",
        materials: "Mahsulot uchun material kiritilishi shart",
        salePrice: "Sotuv narxi kiritilishi shart",
      },
      properties: {
        productName: "Mahsulot nomi 100 ta belgidan oshmasligi kerak",
        category: "Mahsulot turi 255 ta belgidan oshmasligi kerak",
        salePrice: "Sotuv narxi 0 dan kichik bo'lmasligi kerak",
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

module.exports = normaValidation;