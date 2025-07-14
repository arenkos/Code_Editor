// Tema geçişi
const themeToggle = document.getElementById('theme-toggle');
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
}
themeToggle.onclick = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
};
setTheme(localStorage.getItem('theme') || 'light');

// Activitybar ikonları
const activityBtns = document.querySelectorAll('.activity-btn');
const sidebarPanels = {
    'Explorer': document.getElementById('sidebar-explorer'),
    'Source Control': document.getElementById('sidebar-source'),
    'Run & Debug': document.getElementById('sidebar-run'),
    'Extensions': document.getElementById('sidebar-extensions')
};
const sidebarTitle = document.getElementById('sidebar-title');

activityBtns.forEach(btn => {
    btn.onclick = function() {
        activityBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Tüm panelleri gizle
        Object.values(sidebarPanels).forEach(p => p.style.display = 'none');
        // Sadece ilgili paneli göster
        let title = btn.title;
        if (sidebarPanels[title]) {
            sidebarPanels[title].style.display = 'block';
            sidebarTitle.textContent = title.toUpperCase();
        }
        // Explorer paneli ise, mevcut dizini tekrar yükle
        if (title === 'Explorer') {
            loadFiles(currentExplorerPath || '/');
        }
        // Source Control paneli için outputu temizle
        if (title === 'Source Control') {
            document.getElementById('git-status-output').textContent = '';
        }
        // Run paneli için outputu temizle
        if (title === 'Run & Debug') {
            document.getElementById('run-output').textContent = '';
        }
    };
});
// Explorer ilk açık
sidebarPanels['Explorer'].style.display = 'block';

// Sidebar aç/kapa
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menu-btn');
document.getElementById('sidebar-toggle').onclick = function() {
    sidebar.classList.toggle('open');
    if (!sidebar.classList.contains('open')) {
        document.body.classList.add('sidebar-closed');
        menuBtn.style.display = 'inline-block';
    } else {
        document.body.classList.remove('sidebar-closed');
        menuBtn.style.display = 'none';
    }
};
menuBtn.onclick = function() {
    sidebar.classList.add('open');
    document.body.classList.remove('sidebar-closed');
    menuBtn.style.display = 'none';
};

// Terminal aç/kapa
const showTerminalBtn = document.getElementById('show-terminal-btn');
const terminalPanel = document.getElementById('terminal-panel');
document.getElementById('terminal-toggle').onclick = function() {
    terminalPanel.classList.toggle('open');
    if (!terminalPanel.classList.contains('open')) {
        showTerminalBtn.style.display = 'inline-block';
    } else {
        showTerminalBtn.style.display = 'none';
    }
};
showTerminalBtn.onclick = function() {
    terminalPanel.classList.add('open');
    showTerminalBtn.style.display = 'none';
};

// Sekmeli editör yönetimi
let openTabs = [];
let activeTab = null;
const tabsBar = document.getElementById('tabs-bar');
function openTab(path, name) {
    if (!openTabs.find(t => t.path === path)) {
        openTabs.push({ path, name });
    }
    activeTab = path;
    renderTabs();
    if (explorerMode === 'local' || explorerMode === 'upload') {
        loadFileContent(path);
    } else if (explorerMode === 'github') {
        let cleanPath = path;
        while (cleanPath.startsWith('github:')) cleanPath = cleanPath.slice(7);
        if (cleanPath) openGithubFile(cleanPath, false); // tekrar openTab çağrılmasın
    }
}
function setActiveTab(path) {
    activeTab = path;
    loadFileContent(path);
    renderTabs();
}
function closeTab(path) {
    openTabs = openTabs.filter(t => t.path !== path);
    if (activeTab === path) {
        if (openTabs.length > 0) {
            setActiveTab(openTabs[openTabs.length - 1].path);
        } else {
            activeTab = null;
            renderTabs();
            editor.setValue('');
            document.getElementById('current-path').textContent = '';
        }
    } else {
        renderTabs();
    }
}
function renderTabs() {
    tabsBar.innerHTML = '';
    openTabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = 'tab' + (tab.path === activeTab ? ' active' : '');
        tabEl.textContent = tab.name;
        tabEl.onclick = () => setActiveTab(tab.path);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.onclick = (e) => { e.stopPropagation(); closeTab(tab.path); };
        tabEl.appendChild(closeBtn);
        tabsBar.appendChild(tabEl);
    });
}

// Dosya listesi yükle
let currentExplorerPath = '/';
const explorerBackBtn = document.getElementById('explorer-back');
const explorerPathSpan = document.getElementById('explorer-path');
const explorerSearch = document.getElementById('explorer-search');

// Mod: 'local', 'upload', 'github'
let explorerMode = 'local';
let uploadedFiles = [];
let githubFiles = [];
let githubRepoUrl = '';

function loadFiles(path = '/') {
    if (explorerMode === 'upload') {
        showUploadedFiles();
        return;
    }
    if (explorerMode === 'github') {
        showGithubFiles();
        return;
    }
    currentExplorerPath = path;
    if (explorerSearch) explorerSearch.value = '';
    // Terminal oturumunun mevcut dizinini de güncelle
    fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `cd ${path}` })
    });
    fetch(`/api/files?path=${encodeURIComponent(path)}`)
        .then(r => r.json())
        .then(data => {
            const fileList = document.getElementById('file-list');
            fileList.innerHTML = '';
            explorerPathSpan.textContent = path;
            explorerBackBtn.disabled = (path === '/' || path === '');
            data.files.forEach(file => {
                const li = document.createElement('li');
                li.textContent = file.name + (file.type === 'folder' ? '/' : '');
                li.style.cursor = 'pointer';
                li.onclick = () => {
                    if (file.type === 'folder') loadFiles(file.path);
                    else openTab(file.path, file.name);
                };
                fileList.appendChild(li);
            });
        });
}
explorerBackBtn.onclick = function() {
    if (currentExplorerPath === '/' || currentExplorerPath === '') return;
    const parent = currentExplorerPath.replace(/\//g, '/').replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/';
    loadFiles(parent);
};
explorerSearch && explorerSearch.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    fetch(`/api/files?path=${encodeURIComponent(currentExplorerPath)}`)
        .then(r => r.json())
        .then(data => {
            const fileList = document.getElementById('file-list');
            fileList.innerHTML = '';
            data.files.filter(file => file.name.toLowerCase().includes(query)).forEach(file => {
                const li = document.createElement('li');
                li.textContent = file.name + (file.type === 'folder' ? '/' : '');
                li.style.cursor = 'pointer';
                li.onclick = () => {
                    if (file.type === 'folder') loadFiles(file.path);
                    else openTab(file.path, file.name);
                };
                fileList.appendChild(li);
            });
        });
});

// CodeMirror entegrasyonu
let editor = null;
function setupEditor() {
    if (editor) return;
    editor = CodeMirror.fromTextArea(document.getElementById('file-content'), {
        lineNumbers: true,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'material-darker' : 'default',
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        styleActiveLine: true,
        extraKeys: { 'Ctrl-S': saveFile, 'Cmd-S': saveFile }
    });
    // Tema değişince güncelle
    const observer = new MutationObserver(() => {
        editor.setOption('theme', document.documentElement.getAttribute('data-theme') === 'dark' ? 'material-darker' : 'default');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
setupEditor();

// Dosya içeriği yükle (ve dil modunu ayarla)
function loadFileContent(path) {
    fetch(`/api/file-content?path=${encodeURIComponent(path)}`)
        .then(r => r.json())
        .then(data => {
            editor.setValue(data.content || '');
            document.getElementById('file-content').dataset.path = path;
            document.getElementById('current-path').textContent = path;
            // Dil modunu dosya uzantısına göre ayarla
            const ext = path.split('.').pop();
            let mode = 'text/plain';
            if (ext === 'js') mode = 'javascript';
            else if (ext === 'py') mode = 'python';
            else if (ext === 'json') mode = 'application/json';
            else if (ext === 'html') mode = 'htmlmixed';
            else if (ext === 'css') mode = 'css';
            else if (ext === 'md') mode = 'markdown';
            else if (ext === 'sh') mode = 'shell';
            else if (ext === 'xml') mode = 'xml';
            else if (ext === 'yml' || ext === 'yaml') mode = 'yaml';
            editor.setOption('mode', mode);
        });
}

// Dosya kaydet
function saveFile(showAutoSavedTime = false) {
    const path = document.getElementById('file-content').dataset.path;
    const content = editor.getValue();
    fetch('/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
    })
    .then(r => r.json())
    .then(data => {
        if (showAutoSavedTime) {
            const now = new Date();
            const tarih = now.toLocaleDateString('tr-TR');
            const saat = now.toLocaleTimeString('tr-TR');
            document.getElementById('save-status').textContent = `Otomatik kaydedildi: ${tarih} ${saat}`;
        } else {
            document.getElementById('save-status').textContent = data.message || data.error;
            setTimeout(() => document.getElementById('save-status').textContent = '', 2000);
        }
        loadFiles('/');
    });
}
document.getElementById('save-btn').onclick = function() {
    if (explorerMode === 'github') {
        const path = document.getElementById('current-path').textContent;
        const content = editor.getValue();
        const repo_url = githubRepoUrl;
        const token = getGithubToken();
        const commit_message = prompt('Commit mesajı girin:', 'Web editörden güncelleme');
        if (!commit_message) return;
        fetch('/api/github-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repo_url, path, content, commit_message, token })
        })
        .then(r => r.json())
        .then(data => {
            document.getElementById('save-status').textContent = data.success ? 'GitHub push başarılı!' : (data.error || 'Push hatası');
            setTimeout(() => document.getElementById('save-status').textContent = '', 3000);
        });
    } else {
        saveFile();
    }
};

// Terminal
const terminalForm = document.getElementById('terminal-form');
const terminalInput = document.getElementById('terminal-input');
const terminalOutput = document.getElementById('terminal-output');
terminalForm.onsubmit = function(e) {
    e.preventDefault();
    const command = terminalInput.value;
    fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
    })
    .then(r => r.json())
    .then(data => {
        // Satır satır ve kod bloğu olarak göster
        const output = (data.output || data.error || '').replace(/\r?\n/g, '<br>');
        terminalOutput.innerHTML += `<div><span style='color:#4f8cff;'>&gt; ${command}</span></div><div style='margin-bottom:8px;'><code style='white-space:pre-wrap;'>${output}</code></div>`;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        terminalInput.value = '';
    });
};

// Source Control (git status)
const gitStatusBtn = document.getElementById('git-status-btn');
const gitStatusOutput = document.getElementById('git-status-output');
gitStatusBtn && gitStatusBtn.addEventListener('click', function() {
    fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'git status' })
    })
    .then(r => r.json())
    .then(data => {
        gitStatusOutput.textContent = data.output || data.error || '';
    });
});

// Run & Debug (python dosyası çalıştır)
const runBtn = document.getElementById('run-btn');
const runOutput = document.getElementById('run-output');
runBtn && runBtn.addEventListener('click', function() {
    if (!activeTab || !activeTab.endsWith('.py')) {
        runOutput.textContent = 'Sadece açık bir Python dosyası çalıştırılabilir.';
        return;
    }
    const command = `python3 ${activeTab}`;
    fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
    })
    .then(r => r.json())
    .then(data => {
        runOutput.textContent = data.output || data.error || '';
        // Terminal paneline de ekle
        const output = (data.output || data.error || '').replace(/\r?\n/g, '<br>');
        terminalOutput.innerHTML += `<div><span style='color:#4f8cff;'>&gt; ${command}</span></div><div style='margin-bottom:8px;'><code style='white-space:pre-wrap;'>${output}</code></div>`;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    });
});

// Başlangıçta dosya listesini yükle
loadFiles('/');

// --- GITHUB DOSYA AĞACI ---
function buildTree(files) {
    const root = {};
    files.forEach(file => {
        const parts = file.path.split('/');
        let node = root;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!node[part]) {
                node[part] = (i === parts.length - 1) ? { __file: file.path } : {};
            }
            node = node[part];
        }
    });
    return root;
}
function renderTree(node, parentUl, parentPath = '') {
    Object.keys(node).forEach(key => {
        if (key === '__file') return;
        const value = node[key];
        const li = document.createElement('li');
        if (value.__file) {
            // Dosya
            li.textContent = key;
            li.style.cursor = 'pointer';
            li.onclick = () => openGithubFile(value.__file);
            parentUl.appendChild(li);
        } else {
            // Klasör
            li.innerHTML = `<span class='github-folder' style='font-weight:600;cursor:pointer;'><i class="fa-solid fa-folder"></i> ${key}</span>`;
            const subUl = document.createElement('ul');
            subUl.style.display = 'none';
            li.appendChild(subUl);
            li.querySelector('.github-folder').onclick = function(e) {
                e.stopPropagation();
                subUl.style.display = subUl.style.display === 'none' ? 'block' : 'none';
            };
            renderTree(value, subUl, parentPath + '/' + key);
            parentUl.appendChild(li);
        }
    });
}
function showGithubFiles() {
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    const tree = buildTree(githubFiles);
    renderTree(tree, fileList);
}
// --- GITHUB TOKEN ---
function getGithubToken() {
    let token = localStorage.getItem('github_token') || '';
    if (!token) {
        token = prompt('GitHub API limiti için Personal Access Token girin (https://github.com/settings/tokens)');
        if (token) localStorage.setItem('github_token', token);
    }
    return token;
}
function clearGithubToken() {
    localStorage.removeItem('github_token');
}
// --- OTOMATİK KAYIT MOD KONTROLÜ ---
let autoSaveTimeout = null;
if (editor) {
    editor.on('change', function() {
        if (explorerMode !== 'local' && explorerMode !== 'upload') return;
        if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            saveFile(true);
        }, 1000);
    });
}

// Dizin yükle butonu
const uploadDirBtn = document.getElementById('upload-dir-btn');
if (uploadDirBtn) {
    const dirInput = document.createElement('input');
    dirInput.type = 'file';
    dirInput.webkitdirectory = true;
    dirInput.multiple = true;
    dirInput.style.display = 'none';
    uploadDirBtn.parentNode.appendChild(dirInput);
    uploadDirBtn.onclick = () => dirInput.click();
    dirInput.onchange = function() {
        if (!dirInput.files.length) return;
        const formData = new FormData();
        for (const file of dirInput.files) {
            formData.append('files', file, file.webkitRelativePath);
        }
        formData.append('sessionId', 'default');
        fetch('/api/upload-directory', {
            method: 'POST',
            body: formData
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                explorerMode = 'upload';
                // Dosya listesini oluştur
                uploadedFiles = Array.from(dirInput.files).map(f => f.webkitRelativePath);
                showUploadedFiles();
            } else {
                alert('Yükleme hatası: ' + (data.error || ''));
            }
        });
    };
}
function showUploadedFiles() {
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    uploadedFiles.forEach(path => {
        const li = document.createElement('li');
        li.textContent = path;
        li.style.cursor = 'pointer';
        li.onclick = () => openUploadedFile(path);
        fileList.appendChild(li);
    });
}
function openUploadedFile(path) {
    fetch(`/api/file-content?path=${encodeURIComponent('/tmp/uploaded_dirs/default/' + path)}`)
        .then(r => r.json())
        .then(data => {
            openTab('/tmp/uploaded_dirs/default/' + path, path.split('/').pop());
            editor.setValue(data.content || '');
            document.getElementById('file-content').dataset.path = '/tmp/uploaded_dirs/default/' + path;
            document.getElementById('current-path').textContent = path;
        });
}
// GitHub'dan aç butonu
const githubOpenBtn = document.getElementById('github-open-btn');
if (githubOpenBtn) {
    githubOpenBtn.onclick = function() {
        const repoUrl = prompt('GitHub repo URL girin (örn: https://github.com/kullanici/proje)');
        if (repoUrl) {
            const token = getGithubToken();
            fetch('/api/github-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_url: repoUrl, token })
            })
            .then(r => r.json())
            .then(data => {
                if (data.files) {
                    explorerMode = 'github';
                    githubFiles = data.files;
                    githubRepoUrl = repoUrl;
                    showGithubFiles();
                } else {
                    alert('GitHub API hatası: ' + (data.error || ''));
                    if (data.details && data.details.includes('API rate limit')) clearGithubToken();
                }
            });
        }
    };
}
function openGithubFile(path, setTab = true) {
    if (!path) return;
    const token = getGithubToken();
    fetch('/api/github-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: githubRepoUrl, path, token })
    })
    .then(r => r.json())
    .then(data => {
        if (setTab) openTab('github:' + path, path.split('/').pop());
        editor.setValue(data.content || '');
        document.getElementById('file-content').dataset.path = 'github:' + path;
        document.getElementById('current-path').textContent = path;
    });
}

// AI Agent panel aç/kapa
const aiPanel = document.getElementById('ai-agent-panel');
const aiOpenBtn = document.getElementById('ai-agent-open');
const aiCloseBtn = document.getElementById('ai-agent-close');
aiOpenBtn.onclick = () => { aiPanel.classList.remove('closed'); };
aiCloseBtn.onclick = () => { aiPanel.classList.add('closed'); };
// AI Agent mesajlaşma
const aiForm = document.getElementById('ai-agent-form');
const aiInput = document.getElementById('ai-agent-input');
const aiMessages = document.getElementById('ai-agent-messages');
aiForm.onsubmit = function(e) {
    e.preventDefault();
    const msg = aiInput.value.trim();
    if (!msg) return;
    aiMessages.innerHTML += `<div class='ai-msg-user'>${msg}</div>`;
    aiInput.value = '';
    aiMessages.innerHTML += `<div class='ai-msg-agent'>AI yanıtı (demo): <br>"${msg}"</div>`;
    aiMessages.scrollTop = aiMessages.scrollHeight;
    // Sonraki adımda backend'e istek atılacak
};

async function sendAIMessage(message, filePath = null) {
    const service = document.getElementById('ai-service').value;
    const apiKey = document.getElementById('ai-api-key').value;
    const editMode = document.getElementById('edit-mode').value;

    const res = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            file_path: filePath,
            service,
            api_key: apiKey,
            edit_mode: editMode
        })
    });
    return await res.json();
}

// Chat paneli mesaj gönderimini bu fonksiyona bağla
// Örnek:
document.getElementById('ai-agent-send-btn').onclick = async function() {
    const input = document.getElementById('ai-agent-input');
    const message = input.value.trim();
    if (!message) return;
    // Dosya ile ilgili komutsa filePath parametresi eklenebilir
    const response = await sendAIMessage(message);
    // Yanıtı chat paneline ekle
    if (response.reply) {
        // ... chat paneline yanıtı ekle ...
    } else if (response.error) {
        // ... hata mesajı göster ...
    }
    input.value = '';
}; 