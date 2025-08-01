const SalaryRecord = require("../../model/salaryRecord");
const response = require("../../utils/response");
const Incoming = require("../../model/Income");
const Admins = require("../../model/adminModel");

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
        lastDay.setHours(23, 59, 59, 999); // oyning oxirgi kuni, soat 23:59:59.999

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

  async getSalariesBTM3(req, res) {
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
        lastDay.setHours(23, 59, 59, 999); // bu lokal vaqt bo‘ladi
        filter.date = {
          $gte: firstDay,
          $lte: lastDay,
        };
      }

      filter.materials = { $elemMatch: { category: "BN-3" } };
      let records = await Incoming.find(filter).populate(
        "workerPayments.workerId"
      );

      // Barcha workerPayments ni bitta massivga yig‘amiz
      const allPayments = records.flatMap((r) => r.workerPayments || []);

      const summary = {};
      for (const wp of allPayments) {
        // workerId ni stringga o‘tkazamiz
        const id = wp.workerId?._id
          ? wp.workerId._id?.toString()
          : wp.workerId?.toString();
        if (!summary[id]) {
          summary[id] = {
            workerId: id,
            totalPayment: 0,
            worker: wp.workerId, // populated object
          };
        }
        summary[id].totalPayment += wp.payment;
      }

      const result = Object.values(summary);

      return response.success(res, "Worker payments summary", result);
    } catch (error) {
      console.log(error);

      return response.serverError(
        res,
        "Failed to retrieve salary records",
        error
      );
    }
  }
}

module.exports = new SalaryRecordController();
