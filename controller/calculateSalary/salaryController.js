const SalaryRecord = require("../../model/salaryRecord");
const response = require("../../utils/response");

class SalaryRecordController {
  async getAll(req, res) {
    try {
      const { startDate, endDate } = req.query;
      let filter = {};

      if (startDate && endDate) {
        filter.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      } else {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        filter.date = {
          $gte: firstDay,
          $lte: lastDay,
        };
      }

      const salaryRecords = await SalaryRecord.find(filter)
        .populate("workers.employee")
        .sort({ date: -1 });

      if (salaryRecords.length === 0) {
        return response.error(res, "No salary records found");
      }

      return response.success(
        res,
        "Salary records retrieved successfully",
        salaryRecords
      );
    } catch (error) {
      return response.error(res, "Failed to retrieve salary records", error);
    }
  }
}

module.exports = new SalaryRecordController();
