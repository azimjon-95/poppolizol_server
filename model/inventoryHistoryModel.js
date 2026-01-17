const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        trim: true,
        enum: ['BN-5 Qop', 'Stakan kichik', 'Stakan katta', "BN-5 Melsiz",],
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
        type: mongoose.Schema.Types.Mixed,
        required: true,
        validate: {
            validator: (value) => typeof value === 'string' || typeof value === 'number',
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

    // 🔴 YANGI: Qaynatish jarayoni holati
    boilingStatus: {
        type: String,
        enum: ['pending', 'boiling', 'finished'],
        default: 'pending',
        index: true
    },

    date: {
        type: Date,
        required: true,
        index: true
    },

    // 🔴 Qozonga tashlangan vaqt
    boilingStartTime: {
        type: Date,
        index: true
    },

    // 🔴 Qozondan olingan vaqt
    boilingEndTime: {
        type: Date
    },

    // 🔴 Qaynatish davomiyligi (sekundlarda, avto hisoblanadi)
    boilingDurationSeconds: {
        type: Number,
        min: 0,
        default: 0
    },

    bn5Amount: {
        type: Number,
        required: true,
        min: 0
    },

    // 🔴 BN-5 ni qanday taqsimlangan
    bn5ForSale: {
        type: Number,
        min: 0,
        default: 0
    },
    bn5ForMel: {
        type: Number,
        min: 0,
        default: 0
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

// Virtual: Umumiy xarajat
inventorySchema.virtual('totalCost').get(function () {
    return this.bn5Amount + this.melAmount + this.electricity +
        this.gasAmount + this.extra + (this.kraftPaper * this.price);
});

// Virtual: Qaynatish davomiyligi matn ko‘rinishida (HH:MM:SS)
inventorySchema.virtual('boilingDurationFormatted').get(function () {
    if (!this.boilingDurationSeconds) return '00:00:00';
    const hours = String(Math.floor(this.boilingDurationSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((this.boilingDurationSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(this.boilingDurationSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
});

// Indexlar: Tez qidiruv uchun
inventorySchema.index({ boilingStatus: 1, date: -1 });
inventorySchema.index({ boilingStartTime: -1 });
inventorySchema.index({ productionName: 1, boilingStatus: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);