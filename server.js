require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mime = require('mime-types');
const archiver = require('archiver');
const os = require('os');
const { execSync } = require('child_process');
const session = require('express-session');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

function md5(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

// Setup NodeMailer Transporter
function getMailTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

    if (!host || !user || !pass) {
        return null; // SMTP is not configured
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
            user,
            pass
        }
    });
}

const app = express();
const PORT = process.env.PORT || 3000;

// NAS root directory - change this to your NAS mount point
const NAS_ROOT = process.env.NAS_ROOT || (process.platform === 'win32' ? path.join(__dirname, 'nas-data') : '/mnt/nas');

// Ensure NAS_ROOT exists
if (!fs.existsSync(NAS_ROOT)) {
    fs.mkdirSync(NAS_ROOT, { recursive: true });
}

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'nas_secure_secret_key_987654321',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: false // true if running on HTTPS
    }
}));

app.use(express.json());

// Database Wrapper & Initialization
let db = null;
let useMySQL = process.env.USE_MYSQL === 'true';
const USER_FILE = path.join(NAS_ROOT, 'users.json');

// Local user store fallback
function getLocalUsers() {
    try {
        if (!fs.existsSync(USER_FILE)) {
            const defaultUsers = [
                {
                    id: 1,
                    username: 'admin',
                    password: md5('anhanh123'),
                    email: 'admin@nas.local'
                },
                {
                    id: 2,
                    username: 'nqatech',
                    password: md5('anhanh123'),
                    email: 'nqatech@nas.local'
                }
            ];
            fs.writeFileSync(USER_FILE, JSON.stringify(defaultUsers, null, 4));
            return defaultUsers;
        }
        return JSON.parse(fs.readFileSync(USER_FILE, 'utf8'));
    } catch(e) {
        return [];
    }
}

async function findUserByUsername(username) {
    if (useMySQL && db) {
        try {
            const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
            return rows[0] || null;
        } catch (e) {
            console.error('[ERROR] MySQL query failed, falling back to local file:', e.message);
            // Dynamic fallback on query failure
            const users = getLocalUsers();
            return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
        }
    } else {
        const users = getLocalUsers();
        return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    }
}

async function findUserByEmail(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (useMySQL && db) {
        try {
            const [rows] = await db.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
            return rows[0] || null;
        } catch (e) {
            console.error('[ERROR] MySQL query failed, falling back to local file:', e.message);
            const users = getLocalUsers();
            return users.find(u => (u.email || '').toLowerCase() === cleanEmail) || null;
        }
    } else {
        const users = getLocalUsers();
        return users.find(u => (u.email || '').toLowerCase() === cleanEmail) || null;
    }
}

async function findUserByResetToken(token) {
    if (!token) return null;
    if (useMySQL && db) {
        try {
            const [rows] = await db.query('SELECT * FROM users WHERE reset_token = ?', [token]);
            return rows[0] || null;
        } catch (e) {
            console.error('[ERROR] MySQL query failed, falling back to local file:', e.message);
        }
    }
    const users = getLocalUsers();
    return users.find(u => u.resetToken === token) || null;
}

async function updateUserPasswordReset(userId, token, expires) {
    if (useMySQL && db) {
        try {
            await db.query('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?', [token, expires, userId]);
            return true;
        } catch (e) {
            console.error('[ERROR] MySQL update failed:', e.message);
        }
    }
    // Fallback to updating in local file
    try {
        const users = getLocalUsers();
        const user = users.find(u => u.id === userId);
        if (user) {
            user.resetToken = token;
            user.resetExpires = expires ? (expires instanceof Date ? expires.toISOString() : expires) : null;
            fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 4));
            return true;
        }
    } catch (e) {
        console.error('[ERROR] Local user update failed:', e.message);
    }
    return false;
}

async function updateUserPassword(userId, passwordHash) {
    if (useMySQL && db) {
        try {
            await db.query('UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?', [passwordHash, userId]);
            return true;
        } catch (e) {
            console.error('[ERROR] MySQL update password failed:', e.message);
        }
    }
    // Fallback
    try {
        const users = getLocalUsers();
        const user = users.find(u => u.id === userId);
        if (user) {
            user.password = passwordHash;
            delete user.resetToken;
            delete user.resetExpires;
            fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 4));
            return true;
        }
    } catch(e) {
        console.error('[ERROR] Local user update password failed:', e.message);
    }
    return false;
}

async function initDB() {
    if (!useMySQL) {
        console.log('[INFO] Using local JSON file user store (MySQL disabled).');
        getLocalUsers(); // Ensure files & seed users exist
        return;
    }

    try {
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });
        
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'nas_manager'}\`;`);
        await connection.end();
        
        db = await mysql.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'nas_manager',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                email VARCHAR(100) UNIQUE,
                reset_token VARCHAR(255),
                reset_expires TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Migration helper: dynamically add new columns if they do not exist
        try {
            await db.query(`ALTER TABLE users ADD COLUMN email VARCHAR(100) UNIQUE AFTER password;`);
        } catch(e) {}
        try {
            await db.query(`ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) AFTER email;`);
        } catch(e) {}
        try {
            await db.query(`ALTER TABLE users ADD COLUMN reset_expires TIMESTAMP NULL AFTER reset_token;`);
        } catch(e) {}

        const [rows] = await db.query('SELECT COUNT(*) as count FROM users');
        if (rows[0].count === 0) {
            const adminPass = md5('anhanh123');
            await db.query('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', ['admin', adminPass, 'admin@nas.local']);
            await db.query('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', ['nqatech', adminPass, 'nqatech@nas.local']);
            console.log('[INFO] Seeded default users (admin, nqatech) in MySQL.');
        } else {
            // Check if existing users need to be updated with seed emails
            try {
                await db.query(`UPDATE users SET email = 'admin@nas.local' WHERE username = 'admin' AND (email IS NULL OR email = '');`);
                await db.query(`UPDATE users SET email = 'nqatech@nas.local' WHERE username = 'nqatech' AND (email IS NULL OR email = '');`);
            } catch(e) {}
        }
        console.log('[INFO] Connected to MySQL database successfully.');
    } catch(err) {
        console.error('[ERROR] Failed to connect to MySQL database:', err.message);
        console.log('[INFO] Falling back to local JSON file user store.');
        useMySQL = false;
        getLocalUsers(); // initialize local file
    }
}

// Authentication Protection Middleware
app.use((req, res, next) => {
    const publicPaths = ['/login', '/reset-password.html', '/api/auth/login', '/api/auth/status'];
    if (publicPaths.includes(req.path) || req.path.startsWith('/api/auth/')) {
        return next();
    }
    
    // Allow static files like styles, images, fonts (needed for login page)
    if (req.path !== '/' && req.path !== '/index.html' && !req.path.startsWith('/api/')) {
        return next();
    }
    
    if (!req.session || !req.session.userId) {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/login');
    }
    next();
});

// Serve static files after auth middleware
app.use(express.static(path.join(__dirname, 'public')));

// Security: prevent path traversal
function safePath(userPath) {
    const resolved = path.resolve(NAS_ROOT, userPath || '');
    if (!resolved.startsWith(path.resolve(NAS_ROOT))) {
        throw new Error('Access denied: path traversal detected');
    }
    return resolved;
}

// Helper: get file info
function getFileInfo(filePath, name) {
    try {
        const stats = fs.statSync(filePath);
        const ext = path.extname(name).toLowerCase();
        return {
            name,
            path: path.relative(NAS_ROOT, filePath).replace(/\\/g, '/'),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime.toISOString(),
            created: stats.birthtime.toISOString(),
            ext: ext,
            mime: mime.lookup(name) || (stats.isDirectory() ? 'directory' : 'application/octet-stream'),
            isImage: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext),
            isVideo: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m3u8', '.ts'].includes(ext),
            isAudio: ['.mp3', '.flac', '.wav', '.ogg', '.aac', '.m4a', '.wma'].includes(ext),
            isText: ['.txt', '.md', '.json', '.js', '.py', '.sh', '.css', '.html', '.xml', '.yml', '.yaml', '.ini', '.conf', '.log', '.csv', '.kt', '.java', '.c', '.cpp', '.h', '.rs', '.go', '.toml'].includes(ext),
            isPdf: ext === '.pdf',
            isArchive: ['.zip', '.tar', '.gz', '.7z', '.rar', '.bz2', '.xz'].includes(ext)
        };
    } catch (e) {
        return null;
    }
}

// API: List directory
app.get('/api/files', (req, res) => {
    try {
        const dirPath = safePath(req.query.path || '');
        const items = fs.readdirSync(dirPath);
        const files = items
            .map(name => getFileInfo(path.join(dirPath, name), name))
            .filter(Boolean)
            .sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
        
        const relativePath = path.relative(NAS_ROOT, dirPath).replace(/\\/g, '/');
        res.json({
            currentPath: relativePath || '',
            parentPath: relativePath ? path.dirname(relativePath).replace(/\\/g, '/') : null,
            files,
            totalFiles: files.filter(f => !f.isDirectory).length,
            totalFolders: files.filter(f => f.isDirectory).length
        });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// API: Storage info
app.get('/api/storage', (req, res) => {
    try {
        let total = 0, free = 0, used = 0;
        const resolvedPath = path.resolve(NAS_ROOT);
        
        if (process.platform === 'win32') {
            try {
                const escapedPath = resolvedPath.replace(/'/g, "''");
                const psCmd = `powershell -Command "$d = Get-Volume -FilePath '${escapedPath}'; [PSCustomObject]@{Size=$d.Size; Free=$d.SizeRemaining} | ConvertTo-Json"`;
                const psOutput = execSync(psCmd).toString().trim();
                const diskInfo = JSON.parse(psOutput);
                total = diskInfo.Size || 0;
                free = diskInfo.Free || 0;
                used = total - free;
            } catch(e) {
                try {
                    const driveLetter = resolvedPath.substring(0, 2);
                    const psCmd = `powershell -Command "Get-CimInstance Win32_LogicalDisk | Where-Object DeviceID -eq '${driveLetter}' | Select-Object Size, FreeSpace | ConvertTo-Json"`;
                    const psOutput = execSync(psCmd).toString().trim();
                    const diskInfo = JSON.parse(psOutput);
                    total = diskInfo.Size || 0;
                    free = diskInfo.FreeSpace || 0;
                    used = total - free;
                } catch(err2) {
                    total = 200 * 1024 * 1024 * 1024;
                    used = 28 * 1024 * 1024 * 1024;
                    free = total - used;
                }
            }
        } else {
            try {
                const output = execSync(`df -Pk "${resolvedPath}"`).toString().trim().split('\n');
                if (output.length >= 2) {
                    const parts = output[output.length - 1].split(/\s+/);
                    total = (parseInt(parts[1]) || 0) * 1024;
                    free = (parseInt(parts[3]) || 0) * 1024;
                    used = total - free;
                } else {
                    throw new Error('Unexpected df output');
                }
            } catch(e) {
                total = 200 * 1024 * 1024 * 1024;
                used = 28 * 1024 * 1024 * 1024;
                free = total - used;
            }
        }
        res.json({
            total,
            used,
            free,
            hostname: os.hostname(),
            platform: os.platform(),
            uptime: os.uptime(),
            nasRoot: resolvedPath
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Download file
app.get('/api/download', (req, res) => {
    try {
        const filePath = safePath(req.query.path);
        if (fs.statSync(filePath).isDirectory()) {
            // Zip directory for download
            const archive = archiver('zip', { zlib: { level: 5 } });
            res.attachment(path.basename(filePath) + '.zip');
            archive.pipe(res);
            archive.directory(filePath, path.basename(filePath));
            archive.finalize();
        } else {
            res.download(filePath);
        }
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// API: Stream/preview file
app.get('/api/preview', (req, res) => {
    try {
        const filePath = safePath(req.query.path);
        const stat = fs.statSync(filePath);
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        
        // Handle range requests for video streaming
        const range = req.headers.range;
        if (range && mimeType.startsWith('video')) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunkSize = end - start + 1;
            const stream = fs.createReadStream(filePath, { start, end });
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType
            });
            stream.pipe(res);
        } else {
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Length', stat.size);
            fs.createReadStream(filePath).pipe(res);
        }
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// API: Read text file
app.get('/api/read', (req, res) => {
    try {
        const filePath = safePath(req.query.path);
        const maxSize = 2 * 1024 * 1024; // 2MB limit
        const stat = fs.statSync(filePath);
        if (stat.size > maxSize) {
            return res.status(400).json({ error: 'File too large to preview (max 2MB)' });
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content, size: stat.size });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// API: Upload files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            const destPath = safePath(req.query.path || '');
            cb(null, destPath);
        } catch (e) {
            cb(e);
        }
    },
    filename: (req, file, cb) => {
        // Handle duplicate names
        const destDir = safePath(req.query.path || '');
        let finalName = file.originalname;
        let counter = 1;
        while (fs.existsSync(path.join(destDir, finalName))) {
            const ext = path.extname(file.originalname);
            const base = path.basename(file.originalname, ext);
            finalName = `${base} (${counter})${ext}`;
            counter++;
        }
        cb(null, finalName);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 * 1024 } }); // 10GB limit

app.post('/api/upload', upload.array('files', 50), (req, res) => {
    try {
        const uploaded = req.files.map(f => ({
            name: f.filename,
            size: f.size,
            path: path.relative(NAS_ROOT, f.path).replace(/\\/g, '/')
        }));
        res.json({ success: true, files: uploaded });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// API: Create directory
app.post('/api/mkdir', (req, res) => {
    try {
        const dirPath = safePath(path.join(req.body.path || '', req.body.name));
        fs.mkdirSync(dirPath, { recursive: true });
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// API: Rename
app.post('/api/rename', (req, res) => {
    try {
        const oldPath = safePath(req.body.oldPath);
        const dir = path.dirname(oldPath);
        const newPath = path.join(dir, req.body.newName);
        if (!newPath.startsWith(path.resolve(NAS_ROOT))) {
            throw new Error('Access denied');
        }
        fs.renameSync(oldPath, newPath);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// API: Delete
app.post('/api/delete', (req, res) => {
    try {
        const filePath = safePath(req.body.path);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(filePath);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// API: Move/Copy
app.post('/api/move', (req, res) => {
    try {
        const src = safePath(req.body.src);
        const dest = safePath(path.join(req.body.dest, path.basename(src)));
        if (req.body.copy) {
            const stat = fs.statSync(src);
            if (stat.isDirectory()) {
                fs.cpSync(src, dest, { recursive: true });
            } else {
                fs.copyFileSync(src, dest);
            }
        } else {
            fs.renameSync(src, dest);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// API: Search
app.get('/api/search', (req, res) => {
    try {
        const query = (req.query.q || '').toLowerCase();
        const searchPath = safePath(req.query.path || '');
        const results = [];
        const maxResults = 100;
        
        function searchDir(dir, depth) {
            if (depth > 5 || results.length >= maxResults) return;
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    if (results.length >= maxResults) break;
                    if (item.toLowerCase().includes(query)) {
                        const info = getFileInfo(path.join(dir, item), item);
                        if (info) results.push(info);
                    }
                    const fullPath = path.join(dir, item);
                    try {
                        if (fs.statSync(fullPath).isDirectory()) {
                            searchDir(fullPath, depth + 1);
                        }
                    } catch(e) {}
                }
            } catch(e) {}
        }
        
        searchDir(searchPath, 0);
        res.json({ results, query });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Auth: Status
app.get('/api/auth/status', (req, res) => {
    res.json({
        loggedIn: !!(req.session && req.session.userId),
        username: req.session ? req.session.username : null
    });
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        
        const user = await findUserByUsername(username.trim());
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        const valid = (md5(password) === user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        req.session.userId = user.id;
        req.session.username = user.username;
        res.json({ success: true, username: user.username });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Auth: Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await findUserByEmail(email);
        if (!user) {
            // Security: don't reveal user existence
            return res.json({ success: true, message: 'If the email exists, a reset link has been generated.' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await updateUserPasswordReset(user.id, token, expires);

        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
        
        const transporter = getMailTransporter();
        if (transporter) {
            const mailOptions = {
                from: process.env.SMTP_FROM || '"NAS Server" <noreply@nas.local>',
                to: email,
                subject: 'NAS Server Password Reset Request',
                text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
                      `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
                      `${resetUrl}\n\n` +
                      `If you did not request this, please ignore this email and your password will remain unchanged.\n`,
                html: `<div style="font-family: sans-serif; padding: 20px; color: #333;">` +
                      `<h2>Khôi phục mật khẩu máy chủ NAS</h2>` +
                      `<p>Bạn nhận được email này vì đã yêu cầu đặt lại mật khẩu cho tài khoản tại NAS Web Manager.</p>` +
                      `<p>Vui lòng nhấn vào nút dưới đây để tiến hành thiết lập mật khẩu mới (liên kết có hiệu lực trong 1 giờ):</p>` +
                      `<div style="margin: 20px 0;"><a href="${resetUrl}" style="background-color: #4ecca3; color: #0a0e1a; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Khôi phục mật khẩu</a></div>` +
                      `<p>Nếu không thực hiện yêu cầu này, bạn có thể bỏ qua email và mật khẩu vẫn sẽ giữ nguyên.</p>` +
                      `</div>`
            };

            await transporter.sendMail(mailOptions);
            console.log(`[INFO] Password reset email sent to ${email}`);
        } else {
            console.log(`\n  ╔══════════════════════════════════════════╗`);
            console.log(`  ║   ⚠️  SMTP NOT CONFIGURED               ║`);
            console.log(`  ╠══════════════════════════════════════════╣`);
            console.log(`  ║   Reset Link for ${user.username.padEnd(23)} ║`);
            console.log(`  ║   ${resetUrl.padEnd(38)} ║`);
            console.log(`  ╚══════════════════════════════════════════╝\n`);
        }

        res.json({ success: true, message: 'If the email exists, a reset link has been generated.' });
    } catch(e) {
        console.error('[ERROR] Forgot password request failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Auth: Verify Token
app.get('/api/auth/verify-token', async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const user = await findUserByResetToken(token);
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const expires = new Date(user.reset_expires || user.resetExpires);
        if (expires < new Date()) {
            return res.status(400).json({ error: 'Token has expired' });
        }

        res.json({ success: true, username: user.username });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Auth: Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        const user = await findUserByResetToken(token);
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        const expires = new Date(user.reset_expires || user.resetExpires);
        if (expires < new Date()) {
            return res.status(400).json({ error: 'Token has expired' });
        }

        const newHash = md5(password);
        await updateUserPassword(user.id, newHash);
        
        console.log(`[INFO] Password reset successful for user: ${user.username}`);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Auth: Logout
app.post('/api/auth/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({ error: 'Logout failed' });
            }
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    } else {
        res.json({ success: true });
    }
});

// Login Page route
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Database and Server
initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n  ╔══════════════════════════════════════════╗`);
        console.log(`  ║   🗂️  NAS Web File Manager                ║`);
        console.log(`  ╠══════════════════════════════════════════╣`);
        console.log(`  ║   URL:  http://localhost:${PORT}             ║`);
        console.log(`  ║   NAS:  ${NAS_ROOT.padEnd(32)}║`);
        console.log(`  ╚══════════════════════════════════════════╝\n`);
    });
});
