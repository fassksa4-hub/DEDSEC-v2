const express = require('express');
const cors = require('cors');
const app = express();

// ========== إعدادات الأمان ==========
const SECRET_TOKEN = "DEDSEC_SECURE_2025_X7K9P2"; // يجب أن يطابق السكربت

// ========== تخزين مؤقت في الذاكرة ==========
let lastCommand = {
    time: 0,
    username: "",
    userId: 0,
    message: "",
    token: ""
};

// قائمة اللاعبين النشطين: username -> { placeId, jobId, lastPing }
const activePlayers = new Map();

// مدة صلاحية اللاعب (30 ثانية بدون ping يعتبر غير نشط)
const PLAYER_TIMEOUT_MS = 30000;

// تنظيف دوري للاعبين المنقطعين
setInterval(() => {
    const now = Date.now();
    for (const [username, data] of activePlayers.entries()) {
        if (now - data.lastPing > PLAYER_TIMEOUT_MS) {
            activePlayers.delete(username);
        }
    }
}, 10000);

// ========== إعدادات Express ==========
app.use(cors());
app.use(express.json());

// للتعامل مع طلبات Roblox التي قد ترسل Content-Type غريب
app.use((req, res, next) => {
    if (req.headers['content-type'] === 'application/json' || req.method === 'POST') {
        // جيد
    }
    next();
});

// ========== نقاط النهاية ==========

// 1. استقبال ping من اللاعبين
app.post('/ping', (req, res) => {
    const { username, userId, placeId, jobId, token } = req.body;
    
    // تحقق من التوكن
    if (token !== SECRET_TOKEN) {
        return res.status(403).json({ error: "Invalid token" });
    }
    
    if (!username) {
        return res.status(400).json({ error: "Username required" });
    }
    
    // تحديث أو إضافة اللاعب
    activePlayers.set(username, {
        userId,
        placeId,
        jobId,
        lastPing: Date.now()
    });
    
    res.json({ status: "ok" });
});

// 2. استقبال أمر جديد من قائد
app.post('/update', (req, res) => {
    const { username, userId, message, time, token } = req.body;
    
    // تحقق من التوكن
    if (token !== SECRET_TOKEN) {
        return res.status(403).json({ error: "Invalid token" });
    }
    
    if (!username || !userId || !message || !time) {
        return res.status(400).json({ error: "Missing fields" });
    }
    
    // تحديث الأمر الأخير
    lastCommand = {
        time,
        username,
        userId,
        message,
        token
    };
    
    res.json({ status: "ok" });
});

// 3. جلب آخر أمر (لجميع اللاعبين)
app.get('/data', (req, res) => {
    res.json(lastCommand);
});

// 4. جلب قائمة اللاعبين النشطين (أسماء فقط)
app.get('/players', (req, res) => {
    const usernames = Array.from(activePlayers.keys());
    res.json(usernames);
});

// 5. جلب بيانات لاعب محدد (لأمر الانضمام)
app.get('/player/:username', (req, res) => {
    const username = req.params.username;
    const playerData = activePlayers.get(username);
    
    if (!playerData) {
        return res.status(404).json({ error: "Player not found" });
    }
    
    res.json({
        placeId: playerData.placeId,
        jobId: playerData.jobId
    });
});

// ========== تشغيل السيرفر ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`DEDSEC server running on port ${PORT}`);
});
