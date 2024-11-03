// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const PayOS = require("@payos/node");
const sqlite3 = require("sqlite3").verbose();

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

const db = new sqlite3.Database("./database.db", (err) => {
    if (err) {
        console.error("Lỗi kết nối SQLite:", err.message);
    } else {
        console.log("Kết nối thành công đến SQLite3 database.");

        db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orderCode TEXT,
                email TEXT,
                fullName TEXT,
                address TEXT,
                country TEXT,
                postalCode TEXT,
                phoneNumber TEXT,
                amount INTEGER,
                items TEXT,
                status TEXT DEFAULT 'PENDING',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error("Lỗi khi tạo bảng `orders`:", err.message);
            } else {
                console.log("Bảng `orders` đã được tạo hoặc tồn tại.");
            }
        });
    }
});

// Định nghĩa route để tạo liên kết thanh toán
app.post("/create-embedded-payment-link", async (req, res) => {
    const YOUR_DOMAIN = `http://localhost:5173`;

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

    // Lấy `id` cuối cùng trong bảng `orders`
    db.get("SELECT id FROM orders ORDER BY id DESC LIMIT 1", (err, row) => {
        if (err) {
            console.error("Lỗi khi lấy id của đơn hàng cuối cùng:", err.message);
            return res.status(500).send("Lỗi khi tạo mã đơn hàng");
        }

        // Nếu có đơn hàng trước đó, lấy id và tăng lên 1; nếu không, bắt đầu với số 1
        const orderCode = row ? row.id + 1 : 1;

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
        payOS.createPaymentLink(body)
            .then(paymentLinkResponse => {
                // Lưu đơn hàng vào cơ sở dữ liệu với `orderCode` mới
                db.run(`
                    INSERT INTO orders (orderCode, email, fullName, address, country, postalCode, phoneNumber, amount, items, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    String(orderCode), // Lưu `orderCode` dưới dạng chuỗi trong cơ sở dữ liệu
                    email,
                    fullName,
                    address,
                    country,
                    postalCode,
                    phoneNumber,
                    totalAmount,
                    JSON.stringify(items),
                    "PENDING",
                ], function (err) {
                    if (err) {
                        console.error("Lỗi khi lưu đơn hàng:", err.message);
                        return res.status(500).send("Lỗi khi lưu đơn hàng");
                    }

                    console.log(`Đơn hàng được lưu với ID ${this.lastID} và mã đơn hàng ${orderCode}`);
                    res.send(paymentLinkResponse);
                });
            })
            .catch(error => {
                console.error("Lỗi khi tạo liên kết thanh toán:", error.message);
                res.status(500).send("Something went wrong");
            });
    });
});



// Route để cập nhật trạng thái đơn hàng khi thanh toán thành công
app.post("/payment-success", (req, res) => {
    const { orderCode } = req.body;

    console.log(orderCode, 'orderCode do troi');


    db.run(`
        UPDATE orders SET status = 'SUCCESS' WHERE orderCode = ?
    `, [orderCode], function (err) {
        if (err) {
            console.error("Lỗi khi cập nhật trạng thái đơn hàng:", err.message);
            return res.status(500).send("Lỗi khi cập nhật trạng thái đơn hàng");
        }

        console.log(`Trạng thái của đơn hàng ${orderCode} đã được cập nhật thành công.`);
        res.send("Trạng thái đơn hàng đã được cập nhật thành công");
    });
});

// Route trả về danh sách tất cả các đơn hàng
app.get("/orders", (req, res) => {
    db.all("SELECT * FROM orders", (err, rows) => {
        if (err) {
            console.error("Lỗi khi lấy danh sách đơn hàng:", err.message);
            return res.status(500).send("Lỗi khi lấy danh sách đơn hàng");
        }
        res.json(rows);
    });
});

app.listen(3030, () => {
    console.log("Server is listening on port 3030");
});
