const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });
require("ajv-errors")(ajv);
require("ajv-formats")(ajv);
const response = require("../utils/response");

const BonusValidation = (req, res, next) => {
  const schema = {
    type: "object",
    properties: {
      employeeId: { type: "string" },
      amount: { type: "number" },
      period: { type: "string" },
      description: { type: "string" },
    },
    required: ["employeeId", "amount", "period"],
    additionalProperties: false,
    errorMessage: {
      required: {
        employeeId: "Xodim ID kiritilishi shart",
        amount: "Bonus miqdori kiritilishi shart",
        period: "qaysi oy uchun (YYYY-MM) kiritilishi shart",
      },
      properties: {
        employeeId: "Xodim ID noto'g'ri formatda",
        amount: "Bonus miqdori musbat raqam bo'lishi kerak",
        period: "Davr YYYY-MM formatida bo'lishi kerak",
        description:
          "Izoh ixtiyoriy, lekin agar kiritilsa, to'g'ri formatda bo'lishi kerak",
      },
    },
  };

  const validate = ajv.compile(schema);
  const result = validate(req.body);

  if (!result) {
    let errorField =
      validate.errors[0].instancePath.replace("/", "") || "Umumiy";
    let errorMessage = validate.errors[0].message;
    return response.error(res, `${errorField} xato: ${errorMessage}`);
  }
  next();
};

module.exports = BonusValidation;
