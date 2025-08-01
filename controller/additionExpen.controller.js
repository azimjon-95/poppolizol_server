const { AdditionExpen } = require("../model/factoryModel"); // to'g'ri path ni kiriting
const response = require("../utils/response"); // siz bergan response class
const mongoose = require("mongoose");

class AdditionExpenController {
    // Yangi qo‘shish
    async create(req, res) {
        try {
            const newExpense = await AdditionExpen.create(req.body);
            return response.created(res, "Expense created successfully", newExpense);
        } catch (err) {
            return response.serverError(res, "Creation failed", err.message);
        }
    }

    // Hammasini olish
    async getAll(req, res) {
        try {
            const expenses = await AdditionExpen.find();
            return response.success(res, "Expenses fetched", expenses);
        } catch (err) {
            return response.serverError(res, "Fetching failed", err.message);
        }
    }

    // ID orqali olish
    async getById(req, res) {
        try {
            const { id } = req.params;
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return response.error(res, "Invalid ID format");
            }

            const expense = await AdditionExpen.findById(id);
            if (!expense) return response.notFound(res, "Expense not found");

            return response.success(res, "Expense fetched", expense);
        } catch (err) {
            return response.serverError(res, "Fetching failed", err.message);
        }
    }

    // Yangilash
    async update(req, res) {
        try {
            const { id } = req.params;
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return response.error(res, "Invalid ID format");
            }

            const updatedExpense = await AdditionExpen.findByIdAndUpdate(id, req.body, {
                new: true,
                runValidators: true,
            });

            if (!updatedExpense) return response.notFound(res, "Expense not found");

            return response.success(res, "Expense updated", updatedExpense);
        } catch (err) {
            return response.serverError(res, "Update failed", err.message);
        }
    }

    // O‘chirish
    async delete(req, res) {
        try {
            const { id } = req.params;
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return response.error(res, "Invalid ID format");
            }

            const deletedExpense = await AdditionExpen.findByIdAndDelete(id);
            if (!deletedExpense) return response.notFound(res, "Expense not found");

            return response.success(res, "Expense deleted", deletedExpense);
        } catch (err) {
            return response.serverError(res, "Delete failed", err.message);
        }
    }
}

module.exports = new AdditionExpenController();
