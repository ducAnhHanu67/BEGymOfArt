// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderCode: String,
    email: String,
    fullName: String,
    address: String,
    country: String,
    postalCode: String,
    phoneNumber: String,
    amount: Number,
    items: [
        {
            name: String,
            quantity: Number,
            price: Number,
        },
    ],
    status: {
        type: String,
        default: "PAID", // Có thể cập nhật thêm các trạng thái khác nếu cần
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Order', orderSchema);
