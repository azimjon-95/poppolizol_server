const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true,
        enum: ['BN-5 Qop', 'Stakan kichik', 'Stakan katta'],
        index: true
    },
    bn5Amount: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    unit: {
        type: String,
        required: true,
        enum: ['dona', 'kg'],
        trim: true
    },
    rope: {
        type: mongoose.Schema.Types.Mixed, // Can be string or number
        required: true,
        validate: {
            validator: (value) => {
                return typeof value === 'string' || typeof value === 'number';
            },
            message: 'Rope must be a string or number'
        }
    }
}, { _id: false });

const inventorySchema = new mongoose.Schema({
    productionName: {
        type: String,
        required: true,
        enum: ['BN-5', 'BN-5 + Mel'],
        trim: true,
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    bn5Amount: {
        type: Number,
        required: true,
        min: 0
    },
    melAmount: {
        type: Number,
        required: true,
        min: 0
    },
    electricity: {
        type: Number,
        required: true,
        min: 0
    },
    gasAmount: {
        type: Number,
        required: true,
        min: 0
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    extra: {
        type: Number,
        required: true,
        min: 0
    },
    kraftPaper: {
        type: Number,
        required: true,
        min: 0
    },
    sellingPrice: {
        type: Number,
        required: true,
        min: 0
    },
    qop: {
        type: Number,
        required: true,
        min: 0
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    items: [itemSchema]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual to calculate total cost
inventorySchema.virtual('totalCost').get(function () {
    return this.bn5Amount + this.melAmount + this.electricity +
        this.gasAmount + this.extra + (this.kraftPaper * this.price);
});

// Index for common queries
inventorySchema.index({ date: -1, productionName: 1, 'items.label': 1 });

module.exports = mongoose.model('Inventory', inventorySchema);