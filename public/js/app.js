// Internationalization (i18n)
const i18n = {
    vi: {
        allFiles: "Tất cả tệp",
        upload: "Tải lên",
        images: "Hình ảnh",
        videos: "Video",
        audio: "Nhạc",
        documents: "Tài liệu",
        archives: "Nén",
        system: "Hệ thống",
        storage: "💾 Dung lượng",
        used: "Đã dùng",
        free: "Trống",
        total: "Tổng dung lượng",
        searchPlaceholder: "Tìm kiếm...",
        newFolder: "Thư mục mới",
        refresh: "Làm mới",
        emptyFolder: "Thư mục trống",
        dragDropHere: "Kéo thả tệp vào đây",
        orSelectFiles: "hoặc",
        selectFileLink: "chọn tệp",
        fromComputer: "từ máy tính",
        dropToUpload: "Thả tệp để tải lên",
        contextOpen: "Mở",
        contextDownload: "Tải xuống",
        contextRename: "Đổi tên",
        contextDelete: "Xóa",
        renameTitle: "Đổi tên",
        renameBtn: "Đổi tên",
        cancel: "Hủy",
        newFolderTitle: "Tạo thư mục mới",
        newFolderInput: "Tên thư mục",
        createBtn: "Tạo",
        uploading: "Đang tải lên...",
        speed: "Tốc độ",
        transferred: "Đã gửi",
        remaining: "Còn lại",
        transferHistory: "Lịch sử truyền",
        downloading: "Đang tải xuống...",
        serverStatusTitle: "Thông tin trạng thái máy chủ NAS Server",
        serverStatusNav: "Trạng thái máy chủ",
        os: "Hệ điều hành",
        uptime: "Thời gian hoạt động",
        hostname: "Tên máy chủ",
        path: "Đường dẫn thư mục",
        days: "ngày",
        hours: "giờ",
        minutes: "phút",
        seconds: "giây",
        close: "Đóng",
        foldersCount: "thư mục",
        filesCount: "tệp",
        resultsCount: "kết quả",
        confirmDelete: "Xóa \"{name}\"?",
        functions: "Chức năng",
        filters: "Bộ lọc",
        logout: "Đăng xuất"
    },
    en: {
        allFiles: "All Files",
        upload: "Upload",
        images: "Images",
        videos: "Videos",
        audio: "Audio",
        documents: "Documents",
        archives: "Archives",
        system: "System",
        storage: "💾 Storage Usage",
        used: "Used",
        free: "Free",
        total: "Total Capacity",
        searchPlaceholder: "Search...",
        newFolder: "New Folder",
        refresh: "Refresh",
        emptyFolder: "Folder is empty",
        dragDropHere: "Drag & drop files here",
        orSelectFiles: "or",
        selectFileLink: "select files",
        fromComputer: "from computer",
        dropToUpload: "Drop files to upload",
        contextOpen: "Open",
        contextDownload: "Download",
        contextRename: "Rename",
        contextDelete: "Delete",
        renameTitle: "Rename",
        renameBtn: "Rename",
        cancel: "Cancel",
        newFolderTitle: "Create New Folder",
        newFolderInput: "Folder name",
        createBtn: "Create",
        uploading: "Uploading...",
        speed: "Speed",
        transferred: "Transferred",
        remaining: "Remaining",
        transferHistory: "Transfer History",
        downloading: "Downloading...",
        serverStatusTitle: "NAS Server Status Information",
        serverStatusNav: "Server status",
        os: "OS Platform",
        uptime: "Uptime",
        hostname: "Hostname",
        path: "Root directory path",
        days: "d",
        hours: "h",
        minutes: "m",
        seconds: "s",
        close: "Close",
        foldersCount: "folders",
        filesCount: "files",
        resultsCount: "results",
        confirmDelete: "Delete \"{name}\"?",
        functions: "Functions",
        filters: "Filters",
        logout: "Log Out"
    }
};

let currentLang = localStorage.getItem('nas_lang') || 'vi';

function toggleLangMenu(e) {
    e.stopPropagation();
    document.getElementById('langDropdown').classList.toggle('show');
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('nas_lang', lang);
    document.getElementById('langDropdown').classList.remove('show');
    applyLanguage();
}

function applyLanguage() {
    // Translate text contents
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang] && i18n[currentLang][key]) {
            el.textContent = i18n[currentLang][key];
        }
    });
    
    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (i18n[currentLang] && i18n[currentLang][key]) {
            el.placeholder = i18n[currentLang][key];
        }
    });

    // Update active language UI
    const flag = currentLang === 'vi' ? '🇻🇳' : '🇬🇧';
    const code = currentLang.toUpperCase();
    document.getElementById('currentLangIcon').textContent = flag;
    document.getElementById('currentLangText').textContent = code;

    // Reload storage text and counts
    loadStorage();
    if (currentFiles.length > 0) {
        renderBreadcrumb();
        const foldersCountStr = i18n[currentLang].foldersCount;
        const filesCountStr = i18n[currentLang].filesCount;
        const folders = currentFiles.filter(f => f.isDirectory).length;
        const files = currentFiles.filter(f => !f.isDirectory).length;
        document.getElementById('fileCount').textContent = 
            `${folders} ${foldersCountStr}, ${files} ${filesCountStr}`;
    }
}

// State
let currentPath = '';
let currentFiles = [];
let renderedFiles = []; // Currently displayed files
let viewMode = 'grid';
let ctxFile = null;
let searchTimeout = null;
let currentFilter = null;
let transferHistory = [];

// Playback playlist state
let previewQueue = [];
let currentPreviewIndex = -1;

// Init
document.addEventListener('DOMContentLoaded', () => {
    applyLanguage();
    loadFiles();
    setupDragDrop();
    document.addEventListener('click', () => {
        hideContextMenu();
        document.getElementById('langDropdown').classList.remove('show');
        const speedDropdown = document.getElementById('speedDropdown');
        if (speedDropdown) speedDropdown.classList.remove('show');
    });
    
    // Setup global keyboard hotkeys for file manager and player
    document.addEventListener('keydown', e => {
        const player = document.getElementById('mediaPlayerOverlay');
        if (player && player.classList.contains('show')) {
            const video = document.querySelector('.media-player-content video');
            if (e.key === 'Escape') {
                closeMediaPlayer();
                e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                if (video) {
                    video.currentTime = Math.max(0, video.currentTime - 10);
                } else {
                    navigateMedia(-1);
                }
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                if (video) {
                    video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
                } else {
                    navigateMedia(1);
                }
                e.preventDefault();
            } else if (e.key === ' ') {
                if (video) {
                    toggleVideoPlay();
                    e.preventDefault();
                }
            } else if (e.key === 'ArrowUp') {
                if (video) {
                    video.volume = Math.min(1, video.volume + 0.1);
                    const slider = document.getElementById('volumeSlider');
                    if (slider) slider.value = video.volume;
                    e.preventDefault();
                }
            } else if (e.key === 'ArrowDown') {
                if (video) {
                    video.volume = Math.max(0, video.volume - 0.1);
                    const slider = document.getElementById('volumeSlider');
                    if (slider) slider.value = video.volume;
                    e.preventDefault();
                }
            } else if (e.key.toLowerCase() === 'f') {
                if (video) {
                    toggleVideoFullscreen();
                    e.preventDefault();
                }
            }
        } else {
            if (e.key === 'Escape') {
                hideModal();
                hideContextMenu();
            }
        }
    });
});

// API Helpers
async function api(url, opts = {}) {
    const res = await fetch(url, opts);
    if (res.status === 401) {
        window.location.href = '/login';
        return;
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (err) {
        console.error('Logout error:', err);
        window.location.href = '/login';
    }
}

// Load files
async function loadFiles(path) {
    if (path !== undefined) currentPath = path;
    currentFilter = null;
    try {
        const data = await api(`/api/files?path=${encodeURIComponent(currentPath)}`);
        currentFiles = data.files;
        renderBreadcrumb();
        renderFiles(data.files);
        
        const foldersCountStr = i18n[currentLang].foldersCount;
        const filesCountStr = i18n[currentLang].filesCount;
        document.getElementById('fileCount').textContent = 
            `${data.totalFolders} ${foldersCountStr}, ${data.totalFiles} ${filesCountStr}`;
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function navigateTo(path) {
    currentPath = path === '.' ? '' : path;
    loadFiles();
    document.getElementById('sidebar').classList.remove('open');
}

// Render breadcrumb
function renderBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    let html = `<span class="breadcrumb-item ${!currentPath ? 'active' : ''}" onclick="navigateTo('')">
        <span class="material-icons-round" style="font-size:18px;vertical-align:middle">home</span> NAS
    </span>`;
    if (currentPath) {
        const parts = currentPath.split('/');
        let accumulated = '';
        parts.forEach((p, i) => {
            accumulated += (i > 0 ? '/' : '') + p;
            const acc = accumulated;
            html += `<span class="breadcrumb-sep">/</span>`;
            html += `<span class="breadcrumb-item ${i === parts.length - 1 ? 'active' : ''}" 
                onclick="navigateTo('${acc}')">${p}</span>`;
        });
    }
    bc.innerHTML = html;
}

// Render files
function renderFiles(files) {
    const container = document.getElementById('fileContainer');
    
    if (currentFilter) {
        files = files.filter(f => {
            if (currentFilter === 'image') return f.isImage;
            if (currentFilter === 'video') return f.isVideo;
            if (currentFilter === 'audio') return f.isAudio;
            if (currentFilter === 'text') return f.isText;
            if (currentFilter === 'archive') return f.isArchive;
            return true;
        });
    }
    
    renderedFiles = files;
    
    if (files.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-icons-round">folder_open</span>
                <h3>Thư mục trống</h3>
                <p>Kéo thả tệp hoặc nhấn "Tải lên" để thêm tệp</p>
            </div>`;
        return;
    }

    if (viewMode === 'grid') {
        container.innerHTML = `<div class="file-grid">${files.map((f, i) => renderGridCard(f, i)).join('')}</div>`;
    } else {
        container.innerHTML = `
            <div class="file-list">
                <div class="file-list-header">
                    <span>Tên</span><span>Kích thước</span><span>Ngày sửa</span><span></span>
                </div>
                ${files.map((f, i) => renderListItem(f, i)).join('')}
            </div>`;
    }
}

function getFileIcon(f) {
    if (f.isDirectory) return { icon: 'folder', cls: 'folder' };
    if (f.isImage) return { icon: 'image', cls: 'image' };
    if (f.isVideo) return { icon: 'movie', cls: 'video' };
    if (f.isAudio) return { icon: 'music_note', cls: 'audio' };
    if (f.isText) return { icon: 'description', cls: 'text' };
    if (f.isPdf) return { icon: 'picture_as_pdf', cls: 'pdf' };
    if (f.isArchive) return { icon: 'archive', cls: 'archive' };
    return { icon: 'insert_drive_file', cls: 'default' };
}

function renderGridCard(f, index) {
    const { icon, cls } = getFileIcon(f);
    const thumb = f.isImage ? 
        `<img class="file-thumb" src="/api/preview?path=${encodeURIComponent(f.path)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">` : '';
    return `
        <div class="file-card" ondblclick="openFileByIndex(${index})" 
            onclick="selectFile(this, event)" oncontextmenu="showCtxByIndex(event, ${index})">
            ${thumb}
            <span class="material-icons-round file-icon ${cls}" ${f.isImage ? 'style="display:none"' : ''}>${icon}</span>
            <div class="file-name">${escHtml(f.name)}</div>
            <div class="file-size">${f.isDirectory ? '' : formatSize(f.size)}</div>
        </div>`;
}

function renderListItem(f, index) {
    const { icon, cls } = getFileIcon(f);
    return `
        <div class="file-list-item" ondblclick="openFileByIndex(${index})" 
            onclick="selectFile(this, event)" oncontextmenu="showCtxByIndex(event, ${index})">
            <div class="file-list-name">
                <span class="material-icons-round ${cls}">${icon}</span>
                <span>${escHtml(f.name)}</span>
            </div>
            <div class="file-meta">${f.isDirectory ? '--' : formatSize(f.size)}</div>
            <div class="file-meta">${formatDate(f.modified)}</div>
            <div class="file-list-actions">
                <button onclick="event.stopPropagation();downloadFileByIndex(${index})" title="Tải xuống">
                    <span class="material-icons-round" style="font-size:16px">download</span>
                </button>
                <button onclick="event.stopPropagation();deleteFileByIndex(${index})" title="Xóa">
                    <span class="material-icons-round" style="font-size:16px">delete</span>
                </button>
            </div>
        </div>`;
}

// File operations Index-based proxies (Fixes quoting errors on filenames)
function openFileByIndex(index) {
    const f = renderedFiles[index];
    if (f) openFile(f);
}

function downloadFileByIndex(index) {
    const f = renderedFiles[index];
    if (f) downloadFile(f.path);
}

function deleteFileByIndex(index) {
    const f = renderedFiles[index];
    if (f) deleteFile(f.path, f.name);
}

function showCtxByIndex(e, index) {
    const f = renderedFiles[index];
    if (f) showCtx(e, f);
}

// File operations
function openFile(f) {
    if (f.isDirectory) {
        navigateTo(f.path);
    } else if (f.isImage || f.isVideo || f.isAudio) {
        // Find previewable files in current list to enable playlist navigation
        const filteredFiles = currentFiles.filter(item => {
            if (currentFilter) {
                if (currentFilter === 'image') return item.isImage;
                if (currentFilter === 'video') return item.isVideo;
                if (currentFilter === 'audio') return item.isAudio;
                return false;
            }
            return item.isImage || item.isVideo || item.isAudio;
        });
        previewQueue = filteredFiles;
        currentPreviewIndex = filteredFiles.findIndex(item => item.path === f.path);
        showPreview(f);
    } else if (f.isText) {
        showTextPreview(f);
    } else {
        downloadFile(f.path);
    }
}

function downloadFile(filePath) {
    const fileName = filePath.split('/').pop();
    const dlPanel = document.getElementById('downloadProgress');
    const dlName = document.getElementById('dlName');
    const dlSpeed = document.getElementById('dlSpeed');
    const dlTransferred = document.getElementById('dlTransferred');
    const dlPercent = document.getElementById('dlPercent');
    const dlBar = document.getElementById('dlBar');

    // Show download panel
    dlName.textContent = fileName;
    dlSpeed.textContent = '--';
    dlTransferred.textContent = '';
    dlPercent.textContent = '0%';
    dlBar.style.width = '0%';
    dlPanel.classList.add('show');

    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/api/download?path=${encodeURIComponent(filePath)}`);
    xhr.responseType = 'blob';

    let lastLoaded = 0;
    let lastTime = Date.now();
    let speeds = [];

    xhr.onprogress = (e) => {
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed > 0.3) {
            const bytesPerSec = (e.loaded - lastLoaded) / elapsed;
            speeds.push(bytesPerSec);
            if (speeds.length > 5) speeds.shift();
            const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
            dlSpeed.textContent = formatSpeed(avgSpeed);
            lastLoaded = e.loaded;
            lastTime = now;
        }
        dlTransferred.textContent = formatSize(e.loaded);
        if (e.lengthComputable) {
            const pct = Math.round(e.loaded / e.total * 100);
            dlPercent.textContent = pct + '%';
            dlBar.style.width = pct + '%';
        }
    };

    xhr.onload = () => {
        const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
        addTransferHistory('⬇️ ' + fileName, avgSpeed, xhr.response.size || 0);
        dlPanel.classList.remove('show');
        // Trigger browser download
        const url = URL.createObjectURL(xhr.response);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        showToast(`Tải xuống: ${fileName} (${formatSpeed(avgSpeed)})`, 'success');
    };

    xhr.onerror = () => {
        dlPanel.classList.remove('show');
        // Fallback to direct download
        const a = document.createElement('a');
        a.href = `/api/download?path=${encodeURIComponent(filePath)}`;
        a.download = ''; a.click();
    };

    xhr.send();
}

async function deleteFile(filePath, name) {
    const confirmMsg = i18n[currentLang].confirmDelete.replace('{name}', name);
    if (!confirm(confirmMsg)) return;
    try {
        await api('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath })
        });
        showToast(`${currentLang === 'vi' ? 'Đã xóa' : 'Deleted'}: ${name}`, 'success');
        loadFiles();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function renameFile(filePath, oldName) {
    showModal(`
        <h3>Đổi tên</h3>
        <input type="text" id="renameInput" value="${escHtml(oldName)}">
        <div class="modal-actions">
            <button onclick="hideModal()">Hủy</button>
            <button class="primary" onclick="doRename('${filePath}')">Đổi tên</button>
        </div>
    `);
    setTimeout(() => {
        const input = document.getElementById('renameInput');
        input.focus();
        const dot = oldName.lastIndexOf('.');
        input.setSelectionRange(0, dot > 0 ? dot : oldName.length);
    }, 100);
}

async function doRename(oldPath) {
    const newName = document.getElementById('renameInput').value.trim();
    if (!newName) return;
    try {
        await api('/api/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPath, newName })
        });
        hideModal();
        showToast('Đã đổi tên', 'success');
        loadFiles();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// New folder
function showNewFolderDialog() {
    showModal(`
        <h3>Tạo thư mục mới</h3>
        <input type="text" id="newFolderInput" placeholder="Tên thư mục">
        <div class="modal-actions">
            <button onclick="hideModal()">Hủy</button>
            <button class="primary" onclick="doCreateFolder()">Tạo</button>
        </div>
    `);
    setTimeout(() => document.getElementById('newFolderInput').focus(), 100);
}

async function doCreateFolder() {
    const name = document.getElementById('newFolderInput').value.trim();
    if (!name) return;
    try {
        await api('/api/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: currentPath, name })
        });
        hideModal();
        showToast(`Đã tạo thư mục: ${name}`, 'success');
        loadFiles();
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Preview & Media Player Overlay Engine
let imgScale = 1;
let imgRotate = 0;
let imgTranslateX = 0;
let imgTranslateY = 0;
let imgIsDragging = false;
let imgStartX = 0;
let imgStartY = 0;

function showPreview(f) {
    const overlay = document.getElementById('mediaPlayerOverlay');
    overlay.classList.add('show');
    renderMediaContent(f);
}

function renderMediaContent(f) {
    const title = document.getElementById('mediaPlayerTitle');
    const subtitle = document.getElementById('mediaPlayerSubtitle');
    const content = document.getElementById('mediaPlayerContent');
    const controls = document.getElementById('mediaPlayerControls');

    title.textContent = f.name;
    subtitle.textContent = `${formatSize(f.size)} • ${formatDate(f.modified)}`;

    // Navigation button states
    document.getElementById('mediaNavPrev').disabled = currentPreviewIndex <= 0;
    document.getElementById('mediaNavNext').disabled = currentPreviewIndex >= previewQueue.length - 1;

    if (f.isImage) {
        content.innerHTML = `<img id="previewImg" src="/api/preview?path=${encodeURIComponent(f.path)}" alt="${escHtml(f.name)}" style="transform: translate(0px, 0px) scale(1) rotate(0deg)">`;
        
        // Build image controls
        controls.innerHTML = `
            <div class="control-group">
                <button class="control-btn" onclick="zoomImage(0.1)" title="Phóng to / Zoom In"><span class="material-icons-round">zoom_in</span></button>
                <button class="control-btn" onclick="zoomImage(-0.1)" title="Thu nhỏ / Zoom Out"><span class="material-icons-round">zoom_out</span></button>
                <button class="control-btn" onclick="rotateImage(90)" title="Xoay phải / Rotate Right"><span class="material-icons-round">rotate_right</span></button>
                <button class="control-btn" onclick="resetImage()" title="Đặt lại / Reset"><span class="material-icons-round">restart_alt</span></button>
            </div>
            <div class="control-group" style="margin-left:auto">
                <button class="control-btn primary" onclick="downloadFile('${f.path.replace(/'/g, "\\'")}')"><span class="material-icons-round">download</span> <span data-i18n="contextDownload">${currentLang === 'vi' ? 'Tải xuống' : 'Download'}</span></button>
            </div>
        `;

        // Setup mouse pan & zoom for the image
        setTimeout(() => {
            const img = document.getElementById('previewImg');
            if (img) setupImageInteractions(img);
        }, 50);

    } else if (f.isVideo) {
        content.innerHTML = `<video id="previewVideo" controls autoplay src="/api/preview?path=${encodeURIComponent(f.path)}"></video>`;
        
        // Build custom video controls
        controls.innerHTML = `
            <div class="control-group">
                <button class="control-btn" id="videoPlayPause" onclick="toggleVideoPlay()"><span class="material-icons-round" id="playPauseIcon">pause</span></button>
                <button class="control-btn" onclick="skipVideo(-10)" title="-10s"><span class="material-icons-round">replay_10</span></button>
                <button class="control-btn" onclick="skipVideo(10)" title="+10s"><span class="material-icons-round">forward_10</span></button>
            </div>
            
            <div class="control-group speed-selector">
                <button class="control-btn" onclick="toggleSpeedDropdown(event)">
                    <span class="material-icons-round" style="font-size:18px">speed</span>
                    <span id="speedVal">1.0x</span>
                </button>
                <div class="speed-dropdown" id="speedDropdown">
                    <div class="speed-opt" onclick="setVideoSpeed(0.5)">0.5x</div>
                    <div class="speed-opt" onclick="setVideoSpeed(0.75)">0.75x</div>
                    <div class="speed-opt active" onclick="setVideoSpeed(1.0)">1.0x</div>
                    <div class="speed-opt" onclick="setVideoSpeed(1.25)">1.25x</div>
                    <div class="speed-opt" onclick="setVideoSpeed(1.5)">1.5x</div>
                    <div class="speed-opt" onclick="setVideoSpeed(2.0)">2.0x</div>
                </div>
            </div>

            <div class="control-group" style="gap:4px">
                <span class="material-icons-round" style="color:var(--text-secondary); font-size:18px">volume_up</span>
                <input type="range" min="0" max="1" step="0.05" value="1" id="volumeSlider" oninput="setVideoVolume(this.value)" style="width:80px; accent-color:var(--accent); cursor:pointer;">
            </div>

            <div class="control-group" style="margin-left:auto">
                <button class="control-btn" onclick="toggleVideoFullscreen()"><span class="material-icons-round">fullscreen</span></button>
                <button class="control-btn primary" onclick="downloadFile('${f.path.replace(/'/g, "\\'")}')"><span class="material-icons-round">download</span></button>
            </div>
        `;

        // Listen to standard video controls play/pause sync
        setTimeout(() => {
            const video = document.getElementById('previewVideo');
            if (video) {
                video.addEventListener('play', () => { document.getElementById('playPauseIcon').textContent = 'pause'; });
                video.addEventListener('pause', () => { document.getElementById('playPauseIcon').textContent = 'play_arrow'; });
            }
        }, 50);

    } else if (f.isAudio) {
        content.innerHTML = `<audio controls autoplay src="/api/preview?path=${encodeURIComponent(f.path)}" style="width:100%"></audio>`;
        controls.innerHTML = `
            <div class="control-group" style="margin-left:auto">
                <button class="control-btn primary" onclick="downloadFile('${f.path.replace(/'/g, "\\'")}')"><span class="material-icons-round">download</span> <span data-i18n="contextDownload">${currentLang === 'vi' ? 'Tải xuống' : 'Download'}</span></button>
            </div>
        `;
    }
}

function navigateMedia(dir) {
    const nextIndex = currentPreviewIndex + dir;
    if (nextIndex >= 0 && nextIndex < previewQueue.length) {
        // Pause current video/audio if any
        const prevVideo = document.getElementById('previewVideo');
        if (prevVideo) prevVideo.pause();
        const prevAudio = document.querySelector('.media-player-content audio');
        if (prevAudio) prevAudio.pause();

        currentPreviewIndex = nextIndex;
        renderMediaContent(previewQueue[nextIndex]);
    }
}

function closeMediaPlayer() {
    const video = document.getElementById('previewVideo');
    if (video) video.pause();
    const audio = document.querySelector('.media-player-content audio');
    if (audio) audio.pause();

    document.getElementById('mediaPlayerOverlay').classList.remove('show');
}

// Image Zoom / Rotate / Pan
function setupImageInteractions(img) {
    imgScale = 1;
    imgRotate = 0;
    imgTranslateX = 0;
    imgTranslateY = 0;
    imgIsDragging = false;

    img.addEventListener('mousedown', e => {
        e.preventDefault();
        imgIsDragging = true;
        imgStartX = e.clientX - imgTranslateX;
        imgStartY = e.clientY - imgTranslateY;
        img.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
        if (!imgIsDragging) return;
        imgTranslateX = e.clientX - imgStartX;
        imgTranslateY = e.clientY - imgStartY;
        updateImageTransform(img);
    });

    window.addEventListener('mouseup', () => {
        imgIsDragging = false;
        img.style.cursor = 'grab';
    });

    // Scroll to zoom
    img.addEventListener('wheel', e => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        zoomImage(delta);
    });
}

function updateImageTransform(img) {
    if (!img) img = document.getElementById('previewImg');
    if (img) {
        img.style.transform = `translate(${imgTranslateX}px, ${imgTranslateY}px) scale(${imgScale}) rotate(${imgRotate}deg)`;
    }
}

// Zoom Image amount
function zoomImage(amount) {
    const img = document.getElementById('previewImg');
    if (img) {
        imgScale = Math.max(0.1, Math.min(6, imgScale + amount));
        updateImageTransform(img);
    }
}

function rotateImage(deg) {
    const img = document.getElementById('previewImg');
    if (img) {
        imgRotate = (imgRotate + deg) % 360;
        updateImageTransform(img);
    }
}

function resetImage() {
    const img = document.getElementById('previewImg');
    if (img) {
        imgScale = 1;
        imgRotate = 0;
        imgTranslateX = 0;
        imgTranslateY = 0;
        updateImageTransform(img);
    }
}

// Video Control Helpers
function toggleVideoPlay() {
    const video = document.getElementById('previewVideo');
    const icon = document.getElementById('playPauseIcon');
    if (video) {
        if (video.paused) {
            video.play();
            icon.textContent = 'pause';
        } else {
            video.pause();
            icon.textContent = 'play_arrow';
        }
    }
}

function skipVideo(seconds) {
    const video = document.getElementById('previewVideo');
    if (video) {
        video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    }
}

function toggleSpeedDropdown(e) {
    e.stopPropagation();
    document.getElementById('speedDropdown').classList.toggle('show');
}

function setVideoSpeed(speed) {
    const video = document.getElementById('previewVideo');
    if (video) {
        video.playbackRate = speed;
        document.getElementById('speedVal').textContent = speed + 'x';
        
        // Mark option active
        document.querySelectorAll('.speed-opt').forEach(opt => {
            opt.classList.toggle('active', parseFloat(opt.textContent) === speed);
        });
    }
    document.getElementById('speedDropdown').classList.remove('show');
}

function setVideoVolume(vol) {
    const video = document.getElementById('previewVideo');
    if (video) {
        video.volume = vol;
    }
}

function toggleVideoFullscreen() {
    const video = document.getElementById('previewVideo');
    if (video) {
        if (video.requestFullscreen) {
            video.requestFullscreen();
        } else if (video.webkitRequestFullscreen) { /* Safari */
            video.webkitRequestFullscreen();
        } else if (video.msRequestFullscreen) { /* IE11 */
            video.msRequestFullscreen();
        }
    }
}

async function showTextPreview(f) {
    try {
        const data = await api(`/api/read?path=${encodeURIComponent(f.path)}`);
        showModal(`
            <div class="preview-modal">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <h3 style="margin:0">${escHtml(f.name)}</h3>
                    <span style="font-size:12px;color:var(--text-muted)">${formatSize(f.size)}</span>
                </div>
                <div class="preview-content"><pre>${escHtml(data.content)}</pre></div>
                <div class="modal-actions">
                    <button onclick="downloadFile('${f.path.replace(/'/g, "\\'")}')">⬇️ Tải xuống</button>
                    <button onclick="hideModal()">Đóng</button>
                </div>
            </div>
        `);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// Upload
function toggleUploadZone() {
    const zone = document.getElementById('uploadZone');
    zone.classList.toggle('active');
}

async function handleFileSelect(files) {
    if (!files.length) return;
    const formData = new FormData();
    const totalSize = Array.from(files).reduce((s, f) => s + f.size, 0);
    Array.from(files).forEach(f => formData.append('files', f));
    
    const progress = document.getElementById('uploadProgress');
    progress.classList.add('show');

    // Reset stats
    document.getElementById('uploadSpeed').textContent = '--';
    document.getElementById('uploadTransferred').textContent = '0 B';
    document.getElementById('uploadETA').textContent = '--';
    document.getElementById('uploadPercent').textContent = '0%';
    document.getElementById('uploadMainBar').style.width = '0%';

    document.getElementById('uploadFileList').innerHTML = 
        Array.from(files).map(f => `
            <div class="transfer-file-item">
                <span style="flex-shrink:0;font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(f.name)}</span>
                <span style="font-size:10px;color:var(--text-muted);flex-shrink:0">${formatSize(f.size)}</span>
                <div class="progress-bar"><div class="progress-bar-fill" style="width:0%"></div></div>
            </div>
        `).join('');

    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;
    let speeds = [];

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/upload?path=${encodeURIComponent(currentPath)}`);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const now = Date.now();
                const elapsed = (now - lastTime) / 1000;
                const pct = Math.round(e.loaded / e.total * 100);

                // Calculate speed (sample every 300ms)
                if (elapsed > 0.3) {
                    const bytesPerSec = (e.loaded - lastLoaded) / elapsed;
                    speeds.push(bytesPerSec);
                    if (speeds.length > 8) speeds.shift();
                    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

                    document.getElementById('uploadSpeed').textContent = formatSpeed(avgSpeed);

                    // ETA
                    const remaining = e.total - e.loaded;
                    if (avgSpeed > 0) {
                        const etaSec = remaining / avgSpeed;
                        document.getElementById('uploadETA').textContent = formatDuration(etaSec);
                    }

                    lastLoaded = e.loaded;
                    lastTime = now;
                }

                document.getElementById('uploadPercent').textContent = pct + '%';
                document.getElementById('uploadTransferred').textContent = formatSize(e.loaded);
                document.getElementById('uploadMainBar').style.width = pct + '%';
                document.querySelectorAll('.progress-bar-fill').forEach(bar => bar.style.width = pct + '%');
            }
        };

        xhr.onload = () => {
            const totalTime = (Date.now() - startTime) / 1000;
            const avgSpeed = totalSize / totalTime;

            if (xhr.status === 200) {
                // Add to history
                const fileNames = Array.from(files).map(f => f.name);
                fileNames.forEach(name => addTransferHistory('📤 ' + name, avgSpeed, totalSize / files.length));
                showUploadHistory();

                // Final stats
                document.getElementById('uploadSpeed').textContent = formatSpeed(avgSpeed);
                document.getElementById('uploadETA').textContent = '✓';
                document.getElementById('uploadPercent').textContent = '100%';
                document.getElementById('uploadMainBar').style.width = '100%';

                showToast(`Tải lên ${files.length} tệp (${formatSpeed(avgSpeed)}, ${formatDuration(totalTime)})`, 'success');

                // Auto-hide after 3s
                setTimeout(() => progress.classList.remove('show'), 3000);
                loadFiles();
                loadStorage();
            } else {
                progress.classList.remove('show');
                showToast('Lỗi tải lên', 'error');
            }
        };

        xhr.onerror = () => { progress.classList.remove('show'); showToast('Lỗi kết nối', 'error'); };
        xhr.send(formData);
    } catch (e) {
        progress.classList.remove('show');
        showToast(e.message, 'error');
    }
    document.getElementById('fileInput').value = '';
}

// Drag & Drop
function setupDragDrop() {
    const area = document.getElementById('fileArea');
    const overlay = document.getElementById('dragOverlay');
    let dragCounter = 0;
    
    document.addEventListener('dragenter', e => { e.preventDefault(); dragCounter++; overlay.classList.add('show'); });
    document.addEventListener('dragleave', e => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { overlay.classList.remove('show'); dragCounter = 0; } });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('show');
        if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files);
    });
}

// Context Menu
function showCtx(e, f) {
    e.preventDefault();
    e.stopPropagation();
    ctxFile = f;
    const menu = document.getElementById('contextMenu');
    menu.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
    menu.classList.add('show');
}
function hideContextMenu() { document.getElementById('contextMenu').classList.remove('show'); }
function ctxOpen() { hideContextMenu(); if (ctxFile) openFile(ctxFile); }
function ctxDownload() { hideContextMenu(); if (ctxFile) downloadFile(ctxFile.path); }
function ctxRename() { hideContextMenu(); if (ctxFile) renameFile(ctxFile.path, ctxFile.name); }
function ctxDelete() { hideContextMenu(); if (ctxFile) deleteFile(ctxFile.path, ctxFile.name); }

// Search
async function handleSearch(q) {
    clearTimeout(searchTimeout);
    if (!q.trim()) { loadFiles(); return; }
    searchTimeout = setTimeout(async () => {
        try {
            const data = await api(`/api/search?q=${encodeURIComponent(q)}&path=${encodeURIComponent(currentPath)}`);
            renderFiles(data.results);
            const resultsCountStr = i18n[currentLang].resultsCount;
            document.getElementById('fileCount').textContent = `${data.results.length} ${resultsCountStr}`;
        } catch (e) { showToast(e.message, 'error'); }
    }, 300);
}

// Filter
function filterByType(type) {
    currentFilter = currentFilter === type ? null : type;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (currentFilter) {
        event.currentTarget.classList.add('active');
    } else {
        document.querySelector('.nav-item').classList.add('active');
    }
    renderFiles(currentFiles);
}

// Storage
async function loadStorage() {
    try {
        const s = await api('/api/storage');
        const pct = parseFloat(s.total > 0 ? ((s.used / s.total) * 100).toFixed(1) : 0);
        
        const bar = document.getElementById('storageBar');
        bar.style.width = pct + '%';
        
        // Premium color-coded warning system
        if (pct < 80) {
            bar.style.background = 'linear-gradient(90deg, var(--accent), var(--accent-blue))';
        } else if (pct < 90) {
            bar.style.background = 'linear-gradient(90deg, var(--accent-orange), var(--accent-yellow))';
        } else {
            bar.style.background = 'linear-gradient(90deg, var(--accent-red), var(--accent-orange))';
        }

        const usedStr = i18n[currentLang].used;
        const freeStr = i18n[currentLang].free;
        
        document.getElementById('storageUsed').textContent = `${usedStr}: ${formatSize(s.used)} (${pct}%)`;
        document.getElementById('storageFree').textContent = `${freeStr}: ${formatSize(s.free)}`;
        document.getElementById('hostname').textContent = s.hostname;
    } catch (e) {}
}

// Server Status Dashboard Modal
async function showSystemStatus() {
    try {
        const s = await api('/api/storage');
        const pct = s.total > 0 ? ((s.used / s.total) * 100).toFixed(1) : 0;
        const freePct = s.total > 0 ? ((s.free / s.total) * 100).toFixed(1) : 0;
        const uptimeFormatted = formatUptime(s.uptime);
        
        let platformIcon = 'computer';
        let platformName = s.platform;
        if (s.platform.toLowerCase().includes('win')) {
            platformIcon = 'desktop_windows';
            platformName = 'Windows';
        } else if (s.platform.toLowerCase().includes('linux')) {
            platformIcon = 'terminal';
            platformName = 'Linux / Ubuntu';
        } else if (s.platform.toLowerCase().includes('darwin')) {
            platformIcon = 'desktop_mac';
            platformName = 'macOS';
        }

        const modalHtml = `
            <div class="system-status-dashboard">
                <div class="system-header">
                    <span class="material-icons-round" style="font-size:28px; color:var(--accent)">settings_suggest</span>
                    <h3 style="margin:0">${i18n[currentLang].serverStatusTitle}</h3>
                </div>
                <div class="system-grid">
                    <div class="system-card">
                        <span class="material-icons-round card-icon" style="color:var(--accent)">dns</span>
                        <div class="card-content">
                            <div class="card-label">${i18n[currentLang].hostname}</div>
                            <div class="card-val">${s.hostname}</div>
                        </div>
                    </div>
                    <div class="system-card">
                        <span class="material-icons-round card-icon" style="color:var(--accent-blue)">${platformIcon}</span>
                        <div class="card-content">
                            <div class="card-label">${i18n[currentLang].os}</div>
                            <div class="card-val">${platformName} (${s.platform})</div>
                        </div>
                    </div>
                    <div class="system-card">
                        <span class="material-icons-round card-icon" style="color:var(--accent-orange)">schedule</span>
                        <div class="card-content">
                            <div class="card-label">${i18n[currentLang].uptime}</div>
                            <div class="card-val">${uptimeFormatted}</div>
                        </div>
                    </div>
                    <div class="system-card full-width">
                        <span class="material-icons-round card-icon" style="color:var(--accent-purple)">folder_shared</span>
                        <div class="card-content">
                            <div class="card-label">${i18n[currentLang].path}</div>
                            <div class="card-val path-val" title="${s.nasRoot}">${s.nasRoot}</div>
                        </div>
                    </div>
                </div>
                
                <div class="system-storage-section">
                    <h4 style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                        <span class="material-icons-round" style="color:var(--accent-blue)">pie_chart</span>
                        <span>${i18n[currentLang].storage}</span>
                    </h4>
                    <div class="storage-dashboard-bar">
                        <div class="storage-db-fill used" style="width:${pct}%" title="${i18n[currentLang].used}: ${pct}%"></div>
                        <div class="storage-db-fill free" style="width:${freePct}%" title="${i18n[currentLang].free}: ${freePct}%"></div>
                    </div>
                    <div class="storage-details-grid">
                        <div class="storage-detail-item used">
                            <span class="dot"></span>
                            <div class="detail-info">
                                <div class="detail-label">${i18n[currentLang].used}</div>
                                <div class="detail-val">${formatSize(s.used)} <span class="pct">(${pct}%)</span></div>
                            </div>
                        </div>
                        <div class="storage-detail-item free">
                            <span class="dot"></span>
                            <div class="detail-info">
                                <div class="detail-label">${i18n[currentLang].free}</div>
                                <div class="detail-val">${formatSize(s.free)} <span class="pct">(${freePct}%)</span></div>
                            </div>
                        </div>
                        <div class="storage-detail-item total">
                            <span class="dot"></span>
                            <div class="detail-info">
                                <div class="detail-label">${i18n[currentLang].total}</div>
                                <div class="detail-val">${formatSize(s.total)}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-actions" style="margin-top:24px">
                    <button class="primary" onclick="hideModal()">${i18n[currentLang].close}</button>
                </div>
            </div>
        `;
        showModal(modalHtml);
    } catch(e) {
        showToast(e.message, 'error');
    }
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor((seconds % (3600*24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    let parts = [];
    if (d > 0) parts.push(`${d} ${i18n[currentLang].days}`);
    if (h > 0) parts.push(`${h} ${i18n[currentLang].hours}`);
    if (m > 0) parts.push(`${m} ${i18n[currentLang].minutes}`);
    if (d === 0 && h === 0 && m === 0) parts.push(`${s} ${i18n[currentLang].seconds}`);
    return parts.join(' ');
}

// View mode
function setView(mode) {
    viewMode = mode;
    document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
    renderFiles(currentFiles);
}

function selectFile(el, e) {
    if (!e.ctrlKey && !e.metaKey) document.querySelectorAll('.file-card.selected,.file-list-item.selected').forEach(c => c.classList.remove('selected'));
    el.classList.toggle('selected');
}

// Modal
function showModal(html) {
    document.getElementById('modalContent').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('show');
}
function hideModal() { document.getElementById('modalOverlay').classList.remove('show'); }
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) hideModal(); });

// Toast
function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="material-icons-round" style="font-size:18px">${type === 'success' ? 'check_circle' : 'error'}</span> ${escHtml(msg)}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Utils
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '--';
    if (bytesPerSec >= 1024 * 1024 * 1024) return (bytesPerSec / (1024*1024*1024)).toFixed(1) + ' GB/s';
    if (bytesPerSec >= 1024 * 1024) return (bytesPerSec / (1024*1024)).toFixed(1) + ' MB/s';
    if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(0) + ' KB/s';
    return bytesPerSec.toFixed(0) + ' B/s';
}
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    if (seconds < 60) return Math.ceil(seconds) + 's';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + Math.ceil(seconds % 60) + 's';
    return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
}
function addTransferHistory(name, speed, size) {
    transferHistory.unshift({ name, speed, size, time: new Date() });
    if (transferHistory.length > 10) transferHistory.pop();
}
function showUploadHistory() {
    const histDiv = document.getElementById('uploadHistory');
    const listDiv = document.getElementById('uploadHistoryList');
    if (transferHistory.length === 0) { histDiv.style.display = 'none'; return; }
    histDiv.style.display = 'block';
    listDiv.innerHTML = transferHistory.slice(0, 5).map(h => `
        <div class="transfer-history-item">
            <span class="th-name">${escHtml(h.name)}</span>
            <span class="th-speed">${formatSpeed(h.speed)}</span>
        </div>
    `).join('');
}
function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function esc(f) { return JSON.stringify(f).replace(/'/g, '&#39;').replace(/"/g, "'"); }
