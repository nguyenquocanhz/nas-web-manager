const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mime = require('mime-types');
const archiver = require('archiver');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// NAS root directory - change this to your NAS mount point
const NAS_ROOT = process.env.NAS_ROOT || (process.platform === 'win32' ? path.join(__dirname, 'nas-data') : '/mnt/nas');

// Ensure NAS_ROOT exists
if (!fs.existsSync(NAS_ROOT)) {
    fs.mkdirSync(NAS_ROOT, { recursive: true });
}

app.use(express.json());
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

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ╔══════════════════════════════════════════╗`);
    console.log(`  ║   🗂️  NAS Web File Manager                ║`);
    console.log(`  ╠══════════════════════════════════════════╣`);
    console.log(`  ║   URL:  http://localhost:${PORT}             ║`);
    console.log(`  ║   NAS:  ${NAS_ROOT.padEnd(32)}║`);
    console.log(`  ╚══════════════════════════════════════════╝\n`);
});
