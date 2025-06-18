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
      materials: {
        type: "array",
        items: {
          type: "object",
          properties: {
            materialId: {
              type: "string",
              minLength: 1,
              maxLength: 255,
            },
            quantity: {
              type: "number",
              minimum: 0,
            },
          },
          required: ["materialId", "quantity"],
          additionalProperties: false,
        },
      },
      description: {
        type: "string",
      },
      size: {
        type: "string",
      },
    },
    required: ["productName", "category", "materials"],
    additionalProperties: false,
    errorMessage: {
      required: {
        productName: "Mahsulot nomi kiritilishi shart",
        category: "Mahsulot turi kiritilishi shart",
        materials: "Mahsulot uchun material kiritilishi shart",
        description: "Mahsulot haqida ma'lumot kiritilishi shart",
        size: "Mahsulot o'lchami kiritilishi shart",
      },
      properties: {
        productName: "Mahsulot nomi 100 ta belgidan oshmasligi kerak",
        category: "Mahsulot turi 255 ta belgidan oshmasligi kerak",
        materials: "Mahsulot uchun material kiritilishi shart",
        description: "Mahsulot haqida ma'lumot kiritilishi shart",
        size: "Mahsulot o'lchami kiritilishi shart",
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
