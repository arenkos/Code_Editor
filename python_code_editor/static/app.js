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
    setActiveTab(path);
    renderTabs();
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

function loadFiles(path = '/') {
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
function saveFile() {
    const path = document.getElementById('file-content').dataset.path;
    const content = editor.getValue();
    fetch('/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
    })
    .then(r => r.json())
    .then(data => {
        document.getElementById('save-status').textContent = data.message || data.error;
        setTimeout(() => document.getElementById('save-status').textContent = '', 2000);
        loadFiles('/');
    });
}
document.getElementById('save-btn').onclick = saveFile;

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