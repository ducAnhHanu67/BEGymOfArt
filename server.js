// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const PayOS = require("@payos/node");
const mongoose = require("mongoose");

// Cấu hình ứng dụng
const app = express();
dotenv.config();
const payOS = new PayOS(
    process.env.PAYOS_CLIENT_ID,
    process.env.PAYOS_API_KEY,
    process.env.PAYOS_CHECKSUM_KEY
);

// Kết nối MongoDB
mongoose.connect("mongodb+srv://ducanhhanu67:3RmuNWFN3ZEOks0H@gymofart.cnz4y.mongodb.net/?retryWrites=true&w=majority&appName=gymOfArt")
    .then(() => console.log("Kết nối thành công đến MongoDB"))
    .catch(err => console.error("Lỗi kết nối MongoDB:", err));

// Định nghĩa schema và model cho đơn hàng
const orderSchema = new mongoose.Schema({
    orderCode: { type: Number, required: true },
    email: { type: String, required: true },
    fullName: { type: String, required: true },
    address: { type: String, required: true },
    country: { type: String, required: true },
    postalCode: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    items: { type: [Object], required: true },
    status: { type: String, default: "PENDING" },
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model("Order", orderSchema);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Định nghĩa route để tạo liên kết thanh toán
app.post("/create-embedded-payment-link", async (req, res) => {
    const YOUR_DOMAIN = `https://gym-of-art.vercel.app/`;

    const {
        email,
        fullName,
        address,
        country,
        postalCode,
        phoneNumber,
        totalAmount,
        items,
    } = req.body;

    const description = `Thanh toán đơn hàng`;

    // Tạo mã đơn hàng mới (orderCode)
    const lastOrder = await Order.findOne().sort({ orderCode: -1 }).limit(1);
    const orderCode = lastOrder
        ? Math.floor(Math.random() * 900000) + 100000  // Tạo số ngẫu nhiên 6 chữ số từ 100000 đến 999999
        : 100000;  // Giá trị mặc định nếu không tìm thấy đơn hàng trước đó

    // Kiểm tra giá trị `orderCode` để đảm bảo nó phù hợp với yêu cầu của PayOS
    if (orderCode > 9007199254740991) {
        console.error("Lỗi: Giá trị của orderCode vượt quá giới hạn cho phép.");
        return res.status(400).send("orderCode vượt quá giới hạn cho phép.");
    }

    const body = {
        orderCode, // Truyền `orderCode` dưới dạng số nguyên
        amount: totalAmount,
        description: description,
        items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price + 2000,
        })),
        customer: {
            email,
            fullName,
            address,
            country,
            postalCode,
            phoneNumber,
        },
        returnUrl: `${YOUR_DOMAIN}/payment-success?orderCode=${orderCode}`,
        cancelUrl: `${YOUR_DOMAIN}/payment-cancel`,
    };

    // Tạo liên kết thanh toán
    try {
        const paymentLinkResponse = await payOS.createPaymentLink(body);

        // Lưu đơn hàng vào MongoDB
        const newOrder = new Order({
            orderCode,
            email,
            fullName,
            address,
            country,
            postalCode,
            phoneNumber,
            amount: totalAmount,
            items,
            status: "PENDING"
        });

        await newOrder.save();

        console.log(`Đơn hàng đã được lưu với mã đơn hàng ${orderCode}`);
        console.log(paymentLinkResponse, 'pay oi pay');

        res.send(paymentLinkResponse);
    } catch (error) {
        console.error("Lỗi khi tạo liên kết thanh toán:", error.message);
        res.status(500).send("Something went wrong");
    }
});

// Route để cập nhật trạng thái đơn hàng khi thanh toán thành công
app.post("/payment-success", async (req, res) => {
    const { orderCode } = req.body;

    console.log(orderCode, 'orderCode do troi');

    try {
        // Tìm và cập nhật trạng thái đơn hàng
        const updatedOrder = await Order.findOneAndUpdate(
            { orderCode }, // Điều kiện tìm kiếm
            { status: 'SUCCESS' }, // Cập nhật trường 'status'
            { new: true } // Trả về tài liệu mới sau khi cập nhật
        );

        if (updatedOrder) {
            console.log(`Trạng thái của đơn hàng ${orderCode} đã được cập nhật thành công.`);
            res.send("Trạng thái đơn hàng đã được cập nhật thành công");
        } else {
            res.status(404).send("Không tìm thấy đơn hàng với mã này");
        }
    } catch (err) {
        console.error("Lỗi khi cập nhật trạng thái đơn hàng:", err.message);
        res.status(500).send("Lỗi khi cập nhật trạng thái đơn hàng");
    }
});


// Route trả về danh sách tất cả các đơn hàng
app.get("/orders", async (req, res) => {
    try {
        const orders = await Order.find();
        res.json(orders);
    } catch (err) {
        console.error("Lỗi khi lấy danh sách đơn hàng:", err.message);
        res.status(500).send("Lỗi khi lấy danh sách đơn hàng");
    }
});

// Route trả về số đơn hàng "SUCCESS" và "PENDING"
app.get("/order-stats", async (req, res) => {
    try {
        // Tính số đơn hàng theo trạng thái "SUCCESS"
        const successCount = await Order.countDocuments({ status: 'SUCCESS' });

        // Tính số đơn hàng theo trạng thái "PENDING"
        const pendingCount = await Order.countDocuments({ status: 'PENDING' });

        // Trả về kết quả
        res.json({
            successCount,
            pendingCount
        });
    } catch (err) {
        console.error("Lỗi khi lấy thống kê đơn hàng:", err.message);
        res.status(500).send("Lỗi khi lấy thống kê đơn hàng");
    }
});

const port = process.env.PORT || 3030;
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});