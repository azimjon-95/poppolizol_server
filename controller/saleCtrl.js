const Sale = require('./sale.model');

class SaleService {
    async createSale(saleData) {
        try {
            const sale = new Sale(saleData);
            return await sale.save();
        } catch (error) {
            throw new Error(`Failed to create sale: ${error.message}`);
        }
    }

    async getSaleById(id) {
        try {
            const sale = await Sale.findOne({ id }).lean();
            if (!sale) throw new Error('Sale not found');
            return sale;
        } catch (error) {
            throw new Error(`Failed to get sale: ${error.message}`);
        }
    }

    async getAllSales({ page = 1, limit = 10, sort = '-createdAt', filter = {} }) {
        try {
            const query = Sale.find(filter)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();
            const [sales, total] = await Promise.all([
                query.exec(),
                Sale.countDocuments(filter)
            ]);
            return {
                sales,
                total,
                page,
                pages: Math.ceil(total / limit)
            };
        } catch (error) {
            throw new Error(`Failed to get sales: ${error.message}`);
        }
    }

    async updateSale(id, updateData) {
        try {
            const sale = await Sale.findOneAndUpdate(
                { id },
                { $set: updateData },
                { new: true, runValidators: true }
            ).lean();
            if (!sale) throw new Error('Sale not found');
            return sale;
        } catch (error) {
            throw new Error(`Failed to update sale: ${error.message}`);
        }
    }

    async deleteSale(id) {
        try {
            const sale = await Sale.findOneAndDelete({ id });
            if (!sale) throw new Error('Sale not found');
            return { message: 'Sale deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete sale: ${error.message}`);
        }
    }
}

module.exports = new SaleService();