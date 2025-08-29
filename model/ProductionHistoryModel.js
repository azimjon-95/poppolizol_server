const mongoose = require('mongoose');

const productionHistorySchema = new mongoose.Schema({
    date: {
        type: Date,
        default: Date.now
    },
    products: [{
        productName: {
            type: String,
            required: true
        },
        quantityProduced: {
            type: Number,
            required: true,
            min: 0
        },
        salePrice: {
            type: Number,
            required: true,
            min: 0
        },
        totalSaleValue: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    materialsUsed: [{
        materialId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Material',
            required: true
        },
        materialName: {
            type: String,
            required: true
        },
        quantityUsed: {
            type: Number,
            required: true,
            min: 0
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },
        totalCost: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    materialStatistics: {
        totalMaterialCost: {
            type: Number,
            required: true,
            min: 0
        }
    },
    gasConsumption: {
        type: Number,
        required: true,
        min: 0
    },
    gasCost: {
        type: Number,
        required: true,
        min: 0
    },
    electricityConsumption: {
        type: Number,
        required: true,
        min: 0
    },
    electricityCost: {
        type: Number,
        required: true,
        min: 0
    },
    otherExpenses: {
        type: Number,
        required: true,
        min: 0
    },
    workerExpenses: {
        type: Number,
        required: true,
        min: 0
    },
    totalBatchCost: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ProductionHistory', productionHistorySchema);