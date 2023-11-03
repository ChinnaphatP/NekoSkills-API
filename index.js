const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const sql = require('mssql');
const azureIdentity = require('@azure/identity');
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(PORT, () => console.log('server is running on port '+PORT));

const config = {
    user: 'sqladmin',
    password: '@Cp0888188459',
    server: 'nekoskills.database.windows.net',
    database: 'OnlineLearning',
    options: {
        encrypt: true, // Use this if you're on Windows Azure
    }
};

async function connectToDatabase() {
    try {
        await sql.connect(config);
        console.log('Connected to Azure SQL Database');
    } catch (err) {
        console.error('Error connecting to Azure SQL Database', err);
    }
}

connectToDatabase();

app.get('/', (req, res) => {
    const routes = [
        { path: '/register', description: 'register' },
        { path: '/login', description: 'login' },
        { path: '/tags', description: 'tags'},
        { path: '/courses/{TagID}', description: 'search course from tag'},
        { path: '/catalogs', description: 'catalogs'},
        { path: '/courses/catalog/{CatalogID}', description: 'search course from catalog'},
        { path: '/videos/course/{CourseID}', description: 'search video from course'},
        { path: '/history', description: 'add to history'},
        { path: '/history/user/{UserID}', description: 'search history from user'},
        { path: '/userdetail/{UserID}', description: 'userdetail'},
        { path: '/upgrade/{UserID}', description: 'upgrade member'},
        { path: '/cancel/{UserID}', description: 'cancel member'},
        { path: '/certificate', description: 'add certificate'},
        { path: '/certificate/user/{UserID}', description: 'search certificate from user'}
    ];

    res.status(200).json(routes);
});

app.post('/register', async (req, res) => {
    const { username, password, confirmPassword, email, firstname, lastname } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นส่งมาหรือไม่
    if (!username || !password || !confirmPassword || !email || !firstname || !lastname) {
        return res.status(400).json({ error: 'โปรดกรอกข้อมูลที่จำเป็นทั้งหมด' });
    }

    // ตรวจสอบว่ารหัสผ่านและยืนยันรหัสผ่านตรงกันหรือไม่
    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน' });
    }

    // กำหนดค่า memberlevel เป็น 1
    const memberlevel = 1;

    const query = `
        INSERT INTO Users (Username, Password, Email, FirstName, LastName, Memberlevel)
        OUTPUT INSERTED.UserID, INSERTED.Username, INSERTED.Email, INSERTED.FirstName, INSERTED.LastName
        VALUES (@username, @password, @email, @firstname, @lastname, @memberlevel)
    `;

    try {
        const request = new sql.Request();
        request.input('username', sql.NVarChar, username);
        request.input('password', sql.NVarChar, password);
        request.input('email', sql.NVarChar, email);
        request.input('firstname', sql.NVarChar, firstname);
        request.input('lastname', sql.NVarChar, lastname);
        request.input('memberlevel', sql.Int, memberlevel);

        // ทำการเพิ่มข้อมูลผู้ใช้ลงในฐานข้อมูล
        const result = await request.query(query);

        // ส่งข้อมูล UserID, Username, Email, FirstName, และ LastName ที่ลงทะเบียนเสร็จเรียบร้อยกลับไป
        const registeredUser = result.recordset[0];
        res.status(201).json(registeredUser);
    } catch (error) {
        // หากมีข้อผิดพลาดในการลงทะเบียน
        res.status(500).json({ error: error.message });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นส่งมาหรือไม่
    if (!username || !password) {
        return res.status(400).json({ error: 'โปรดกรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const query = `
        SELECT UserID, Username, Email, FirstName, LastName
        FROM Users
        WHERE Username = @username AND Password = @password
    `;

    try {
        const request = new sql.Request();
        request.input('username', sql.NVarChar, username);
        request.input('password', sql.NVarChar, password);

        // ทำคำสั่ง SQL เพื่อตรวจสอบการล็อกอิน
        const result = await request.query(query);

        if (result.recordset.length === 1) {
            // ถ้าพบผู้ใช้ที่ตรงกับข้อมูลล็อกอิน
            // ส่งข้อมูลผู้ใช้ที่ล็อกอินเสร็จเรียบร้อยกลับไป
            const loggedInUser = result.recordset[0];
            res.status(200).json(loggedInUser);
        } else {
            // ถ้าไม่พบผู้ใช้ที่ตรงกับข้อมูลล็อกอิน
            res.status(401).json({ error: 'ล็อกอินล้มเหลว' });
        }
    } catch (error) {
        // หากมีข้อผิดพลาดในการล็อกอิน
        res.status(500).json({ error: error.message });
    }
});

app.get('/tags', async (req, res) => {
    const query = `
        SELECT * FROM Tags
    `;

    try {
        const request = new sql.Request();

        // ดึงข้อมูลจากตาราง Tags
        const result = await request.query(query);

        // ส่งข้อมูล Tags กลับไปให้ผู้ใช้
        res.status(200).json(result.recordset);
    } catch (error) {
        // หากมีข้อผิดพลาดในการดึงข้อมูล Tags
        res.status(500).json({ error: error.message });
    }
});

app.get('/courses/:tagid', async (req, res) => {
    const { tagid } = req.params;

    const query = `
        SELECT Courses.CourseID, Courses.CatalogID, Courses.CourseName, Courses.Description
        FROM Courses
        INNER JOIN CoursesTags ON Courses.CourseID = CoursesTags.CourseID
        WHERE CoursesTags.TagID = @tagid
    `;

    try {
        const request = new sql.Request();
        request.input('tagid', sql.Int, tagid);

        // ดึงข้อมูล Courses ที่เกี่ยวข้องกับ TagID
        const result = await request.query(query);

        // ส่งข้อมูล Courses กลับให้ผู้ใช้
        res.status(200).json(result.recordset);
    } catch (error) {
        // หากมีข้อผิดพลาดในการดึงข้อมูล Courses
        res.status(500).json({ error: error.message });
    }
});

app.get('/catalogs', async (req, res) => {
    const query = `
        SELECT * FROM Catalogs
    `;

    try {
        const request = new sql.Request();

        // ดึงข้อมูลจากตาราง Catalogs
        const result = await request.query(query);

        // ส่งข้อมูล Catalogs กลับให้ผู้ใช้
        res.status(200).json(result.recordset);
    } catch (error) {
        // หากมีข้อผิดพลาดในการดึงข้อมูล Catalogs
        res.status(500).json({ error: error.message });
    }
});

app.get('/courses/catalog/:catalogid', async (req, res) => {
    const { catalogid } = req.params;

    const query = `
        SELECT CourseID, CourseName, Description
        FROM Courses
        WHERE CatalogID = @catalogid
    `;

    try {
        const request = new sql.Request();
        request.input('catalogid', sql.Int, catalogid);

        // ดึงข้อมูล Courses ที่เกี่ยวข้องกับ CatalogID
        const result = await request.query(query);

        // ส่งข้อมูล Courses กลับให้ผู้ใช้
        res.status(200).json(result.recordset);
    } catch (error) {
        // หากมีข้อผิดพลาดในการดึงข้อมูล Courses
        res.status(500).json({ error: error.message });
    }
});

app.get('/videos/course/:courseid', async (req, res) => {
    const { courseid } = req.params;

    const query = `
        SELECT VideoID, VideoTitle, URL
        FROM Videos
        WHERE CourseID = @courseid
    `;

    try {
        const request = new sql.Request();
        request.input('courseid', sql.Int, courseid);

        // ดึงข้อมูล Videos ที่เกี่ยวข้องกับ CourseID
        const result = await request.query(query);

        // ส่งข้อมูล Videos กลับให้ผู้ใช้
        res.status(200).json(result.recordset);
    } catch (error) {
        // หากมีข้อผิดพลาดในการดึงข้อมูล Videos
        res.status(500).json({ error: error.message });
    }
});

app.post('/history', async (req, res) => {
    const { UserID, CourseID, VideoID } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นส่งมาหรือไม่
    if (!UserID || !CourseID || !VideoID ) {
        return res.status(400).json({ error: 'โปรดกรอกข้อมูลที่จำเป็นทั้งหมด' });
    }

    const query = `
        INSERT INTO History (UserID, CourseID, VideoID, Date)
        VALUES (@UserID, @CourseID, @VideoID, GETDATE())
    `;

    try {
        const request = new sql.Request();
        request.input('UserID', sql.Int, UserID);
        request.input('CourseID', sql.Int, CourseID);
        request.input('VideoID', sql.Int, VideoID);

        // เพิ่มรายการประวัติลงในฐานข้อมูล
        await request.query(query);

        // ส่งการตอบกลับว่าบันทึกประวัติสำเร็จ
        res.status(201).json({ success: true });
    } catch (error) {
        // หากมีข้อผิดพลาดในการบันทึกประวัติ
        res.status(500).json({ error: error.message });
    }
});

app.get('/history/user/:userid', async (req, res) => {
    const { userid } = req.params;

    const query = `
        SELECT h.Date, c.CourseName, v.VideoTitle, v.URL
        FROM History h
        JOIN Courses c ON h.CourseID = c.CourseID
        JOIN Videos v ON h.VideoID = v.VideoID
        WHERE h.UserID = @userid
    `;

    try {
        const request = new sql.Request();
        request.input('userid', sql.Int, userid);

        // ดึงข้อมูล History และเชื่อมตาราง Courses และ Videos
        const result = await request.query(query);

        // รีเทิร์นข้อมูล Date, CourseName, VideoTitle, และ URL
        res.status(200).json(result.recordset);
    } catch (error) {
        // หากมีข้อผิดพลาดในการดึงข้อมูล History
        res.status(500).json({ error: error.message });
    }
});

app.get('/userdetail/:userid', async (req, res) => {
    const { userid } = req.params;

    const query = `
        SELECT UserID, Username, Email, FirstName, LastName, Memberlevel
        FROM Users
        WHERE UserID = @userid
    `;

    try {
        const request = new sql.Request();
        request.input('userid', sql.Int, userid);

        // ดึงข้อมูลรายละเอียดผู้ใช้
        const result = await request.query(query);

        if (result.recordset.length > 0) {
            // รีเทิร์นข้อมูลรายละเอียดผู้ใช้
            res.status(200).json(result.recordset[0]);
        } else {
            // หากไม่พบผู้ใช้
            res.status(404).json({ error: 'ไม่พบผู้ใช้' });
        }
    } catch (error) {
        // หากมีข้อผิดพลาดในการดึงข้อมูลรายละเอียดผู้ใช้
        res.status(500).json({ error: error.message });
    }
});

app.post('/upgrade/:userid', async (req, res) => {
    const { userid } = req.params;

    const query = `
        UPDATE Users
        SET Memberlevel = 2
        WHERE UserID = @userid
    `;

    try {
        const request = new sql.Request();
        request.input('userid', sql.Int, userid);

        // ทำการอัพเกรดสมาชิกโดยตั้งค่า Memberlevel เป็น 2
        await request.query(query);

        // ส่งการตอบกลับว่าอัพเกรดสมาชิกสำเร็จ
        res.status(200).json({ success: true });
    } catch (error) {
        // หากมีข้อผิดพลาดในการอัพเกรดสมาชิก
        res.status(500).json({ error: error.message });
    }
});

app.post('/cancel/:userid', async (req, res) => {
    const { userid } = req.params;

    const query = `
        UPDATE Users
        SET Memberlevel = 1
        WHERE UserID = @userid
    `;

    try {
        const request = new sql.Request();
        request.input('userid', sql.Int, userid);

        // ยกเลิกการเป็นสมาชิกโดยตั้งค่า Memberlevel เป็น 1
        await request.query(query);

        // ส่งการตอบกลับว่ายกเลิกการเป็นสมาชิกสำเร็จ
        res.status(200).json({ success: true });
    } catch (error) {
        // หากมีข้อผิดพลาดในการยกเลิกการเป็นสมาชิก
        res.status(500).json({ error: error.message });
    }
});

app.post('/certificate', async (req, res) => {
    const { userid, courseid } = req.body;

    const query = `
        INSERT INTO Certificates (UserID, CourseID, Date)
        VALUES (@userid, @courseid, GETDATE())
    `;

    try {
        const request = new sql.Request();
        request.input('userid', sql.Int, userid);
        request.input('courseid', sql.Int, courseid);

        // ทำการบันทึกข้อมูลในตาราง Certificate
        await request.query(query);

        // ส่งการตอบกลับว่าการบันทึกสำเร็จ
        res.status(200).json({ success: true });
    } catch (error) {
        // หากมีข้อผิดพลาดในการบันทึกข้อมูลใน Certificate
        res.status(500).json({ error: error.message });
    }
});

app.get('/certificate/user/:userid', async (req, res) => {
    const { userid } = req.params;

    const query = `
        SELECT
            U.FirstName, U.LastName, U.Email,
            C.CourseName, CERT.Date
        FROM Certificates CERT
        INNER JOIN Users U ON CERT.UserID = U.UserID
        INNER JOIN Courses C ON CERT.CourseID = C.CourseID
        WHERE CERT.UserID = @userid
    `;

    try {
        const request = new sql.Request();
        request.input('userid', sql.Int, userid);

        // ดึงข้อมูล Certificate พร้อมรายละเอียดผู้ใช้และคอร์ส
        const result = await request.query(query);

        if (result.recordset.length === 0) {
            // ถ้าไม่พบ Certificate สำหรับ UserID ที่ระบุ
            res.status(404).json({ error: 'ไม่พบ Certificate สำหรับ UserID ที่ระบุ' });
        } else {
            // ส่งข้อมูล Certificate พร้อมรายละเอียดกลับ
            res.status(200).json(result.recordset);
        }
    } catch (error) {
        // หากมีข้อผิดพลาดในการดึงข้อมูล Certificate
        res.status(500).json({ error: error.message });
    }
});

module.exports = app
