// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const PayOS = require("@payos/node");

// Cấu hình ứng dụng
const app = express();
dotenv.config();
const payOS = new PayOS(
    process.env.PAYOS_CLIENT_ID,
    process.env.PAYOS_API_KEY,
    process.env.PAYOS_CHECKSUM_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Định nghĩa route để tạo liên kết thanh toán
app.post("/create-embedded-payment-link", async (req, res) => {
    const YOUR_DOMAIN = `http://localhost:5173`;

    // Lấy thông tin từ yêu cầu của frontend
    const {
        email,
        fullName,
        address,
        country,
        postalCode,
        phoneNumber,
        totalAmount,
        discountCode,
        items,
    } = req.body;

    console.log(req.body, 'duc anh');


    // Cấu hình thông tin thanh toán để gửi tới PayOS, chú ý phần description
    const description = `Thanh toán đơn hàng`; // Giới hạn ở 25 ký tự

    const body = {
        orderCode: Number(String(Date.now()).slice(-6)), // Mã đơn hàng tạm thời
        amount: totalAmount, // Số tiền từ yêu cầu frontend
        description: description, // Đảm bảo không quá 25 ký tự
        items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price + 2000,
        })),
        customer: {
            email, // Email của người dùng
            fullName,
            address,
            country,
            postalCode,
            phoneNumber,
        },
        returnUrl: `${YOUR_DOMAIN}/payment-success`, // URL khi thanh toán thành công
        cancelUrl: `${YOUR_DOMAIN}/payment-cancel`,  // URL khi hủy thanh toán
    };

    try {
        // Tạo liên kết thanh toán với PayOS
        const paymentLinkResponse = await payOS.createPaymentLink(body);
        res.send(paymentLinkResponse); // Gửi liên kết thanh toán về client

    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
});

// Khởi động server
app.listen(3030, () => {
    console.log("Server is listening on port 3030");
});
