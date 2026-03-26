const express = require('express');
const http = require('http');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==========================================
// قائمة القادة الثابتة (أسماء الحسابات الحقيقية)
// ==========================================
const COMMANDERS = new Set([
    "sj3zx",
    "sj3zxx",
    "sj3zxxx",
    "sj3zxxx3",
    "sj3zxx33"
]);

// تخزين الجلسات النشطة: { username: { token, userId, expiresAt } }
let sessions = new Map();
let players = {};
let commandLog = [];

// ==========================================
// دالة التحقق من الهوية عبر Roblox API
// ==========================================
async function verifyRobloxIdentity(username, userId) {
    try {
        const userResponse = await fetch(`https://users.roblox.com/v1/users/${userId}`);
        if (!userResponse.ok) return false;
        const userData = await userResponse.json();
        if (userData.name !== username) return false;
        if (!COMMANDERS.has(username)) return false;
        return true;
    } catch (err) {
        console.error("خطأ في التحقق من Roblox API:", err);
        return false;
    }
}

// ==========================================
// دالة إنشاء رمز جلسة
// ==========================================
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ==========================================
// نقطة المصادقة (Auth)
// ==========================================
app.post('/auth', async (req, res) => {
    const { username, userId } = req.body;
    if (!username || !userId) {
        return res.status(400).json({ error: 'Missing username or userId' });
    }

    const isValid = await verifyRobloxIdentity(username, userId);
    if (!isValid) {
        console.log(`❌ فشل التحقق من ${username} (userId: ${userId})`);
        return res.status(403).json({ error: 'Authentication failed' });
    }

    const token = generateToken();
    sessions.set(username, {
        token,
        userId,
        expiresAt: Date.now() + 3600000 // ساعة واحدة
    });

    console.log(`✅ تم مصادقة القائد ${username}`);
    res.json({ token });
});

// ==========================================
// Middleware للتحقق من صحة الرمز
// ==========================================
function authMiddleware(req, res, next) {
    const { username, token } = req.body;
    if (!username || !token) {
        return res.status(403).json({ error: 'Missing credentials' });
    }

    const session = sessions.get(username);
    if (!session || session.token !== token) {
        return res.status(403).json({ error: 'Invalid token' });
    }

    if (session.expiresAt < Date.now()) {
        sessions.delete(username);
        return res.status(403).json({ error: 'Token expired' });
    }

    if (!COMMANDERS.has(username)) {
        return res.status(403).json({ error: 'Not a commander' });
    }

    next();
}

// ==========================================
// Ping (تحديث النشاط)
// ==========================================
app.post('/ping', authMiddleware, (req, res) => {
    const { username, placeId, jobId } = req.body;
    players[username] = {
        placeId: placeId || 'unknown',
        jobId: jobId || 'unknown',
        lastSeen: Date.now()
    };
    res.status(200).send('OK');
});

// ==========================================
// إرسال أمر (محمي)
// ==========================================
app.post('/update', authMiddleware, (req, res) => {
    const { username, message, time } = req.body;
    if (!message) return res.status(400).send('Missing message');

    commandLog.push({ username, message, time: time || Date.now() });
    console.log(`📢 أمر من ${username}: ${message}`);
    res.status(200).send('OK');
});

// ==========================================
// جلب آخر أمر (للقراءة فقط)
// ==========================================
app.get('/data', (req, res) => {
    if (commandLog.length === 0) return res.json({ time: 0, message: "", username: "" });
    const last = commandLog[commandLog.length - 1];
    res.json({ time: last.time, message: last.message, username: last.username });
});

// ==========================================
// جلب قائمة اللاعبين النشطين
// ==========================================
app.get('/players', (req, res) => {
    res.json(Object.keys(players));
});

// ==========================================
// جلب بيانات لاعب معين (للقراءة فقط)
// ==========================================
app.get('/player/:name', (req, res) => {
    const name = req.params.name;
    const data = players[name];
    if (data) {
        res.json({ placeId: data.placeId, jobId: data.jobId });
    } else {
        res.status(404).json({ error: 'Player not found' });
    }
});

// ==========================================
// تنظيف الجلسات المنتهية
// ==========================================
setInterval(() => {
    const now = Date.now();
    for (const [name, session] of sessions.entries()) {
        if (session.expiresAt < now) {
            sessions.delete(name);
            console.log(`🗑️ انتهت جلسة ${name}`);
        }
    }
}, 60000);

// تنظيف اللاعبين غير النشطين
setInterval(() => {
    const now = Date.now();
    for (const [name, data] of Object.entries(players)) {
        if (now - data.lastSeen > 60000) delete players[name];
    }
}, 30000);

// ==========================================
// تشغيل الخادم
// ==========================================
const server = http.createServer(app);
server.listen(PORT, () => {
    console.log(`🔐 DEDSEC Secure Server running on port ${PORT}`);
    console.log(`👑 القادة المعتمدون: ${Array.from(COMMANDERS).join(', ')}`);
});
