// Tüm kodu DOMContentLoaded ile sarmala
window.addEventListener('DOMContentLoaded', function() {
  console.log('app.js yüklendi! (DOMContentLoaded)');

  // Tema geçişi
  const themeToggle = document.getElementById('theme-toggle');
  let currentLang = localStorage.getItem('lang') || 'tr';
  if (themeToggle) {
    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      // --- DİL ÇEVİRİSİ ---
      const translations = window.translations || {
        en: { dark: 'Dark', light: 'Light' },
        tr: { dark: 'Koyu', light: 'Açık' },
        de: { dark: 'Dunkel', light: 'Hell' },
        fr: { dark: 'Sombre', light: 'Clair' },
        es: { dark: 'Oscuro', light: 'Claro' },
        hi: { dark: 'गहरा', light: 'हल्का' },
        zh: { dark: '深色', light: '浅色' }
      };
      const t = translations[currentLang] || translations['en'];
      themeToggle.textContent = theme === 'dark' ? `☀️ ${t.light}` : `🌙 ${t.dark}`;
    }
    themeToggle.onclick = function() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      setTheme(current === 'dark' ? 'light' : 'dark');
    };
    setTheme(localStorage.getItem('theme') || 'light');
  }

  // Activitybar ikonları
  window.activityBtns = document.querySelectorAll('.activity-btn');
  window.sidebarPanels = {
    'Explorer': document.getElementById('sidebar-explorer'),
    'Source Control': document.getElementById('sidebar-source'),
    'Run & Debug': document.getElementById('sidebar-run'),
    'Extensions': document.getElementById('sidebar-extensions')
  };
  window.sidebarTitle = document.getElementById('sidebar-title');

  // Fonksiyon dosyanın en başında ve global scope'ta olmalı
  function attachActivityBtnHandlers() {
    if (!window.activityBtns) return;
    window.activityBtns.forEach(btn => {
      btn.onclick = null; // Önce eskiyi temizle
      btn.onclick = function() {
        let title = btn.title;
        if (window.sidebarPanels[title]) {
          if (window.sidebarPanels[title].style.display === 'block' && sidebar.classList.contains('open')) {
            window.sidebarPanels[title].style.display = 'none';
            sidebar.classList.remove('open');
            btn.classList.remove('active');
            return;
          } else {
            sidebar.classList.add('open');
          }
        }
        window.activityBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Object.values(window.sidebarPanels).forEach(p => p.style.display = 'none');
        if (window.sidebarPanels[title]) {
          window.sidebarPanels[title].style.display = 'block';
          window.sidebarTitle.textContent = title.toUpperCase();
        }
        if (title === 'Explorer') {
          window.explorerMode = 'local';
          window.currentExplorerPath = '/';
          loadFiles('/');
        }
        if (title === 'Source Control') {
          document.getElementById('git-status-output').textContent = '';
        }
        if (title === 'Run & Debug') {
          document.getElementById('run-output').textContent = '';
        }
      };
    });
  }

  // Sidebar aç/kapa
  const sidebar = document.getElementById('sidebar');
  //const menuBtn = document.getElementById('menu-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebar && sidebarToggle) {
    document.getElementById('sidebar-toggle').onclick = function() {
      sidebar.classList.toggle('open');
      if (!sidebar.classList.contains('open')) {
        document.body.classList.add('sidebar-closed');
        //menuBtn.style.display = 'inline-block';
      } else {
        document.body.classList.remove('sidebar-closed');
        //menuBtn.style.display = 'none';
      }
    };
  }
  //menuBtn.onclick = function() {
  //    sidebar.classList.add('open');
  //    document.body.classList.remove('sidebar-closed');
  //    menuBtn.style.display = 'none';
  //};

  // Terminal aç/kapa
  const showTerminalBtn = document.getElementById('show-terminal-btn');
  const terminalPanel = document.getElementById('terminal-panel');
  const terminalToggle = document.getElementById('terminal-toggle');
  if (showTerminalBtn && terminalPanel && terminalToggle) {
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
  }

  // Sekmeli editör yönetimi
  let openTabs = []; // { path, name, content, dirty }
  let activeTab = null;
  const tabsBar = document.getElementById('tabs-bar');

  function findTab(path) {
    return openTabs.find(t => t.path === path);
  }

  function openTab(path, name) {
    let tab = findTab(path);
    if (!tab) {
      tab = { path, name, content: null, lastSavedContent: null, dirty: false };
      openTabs.push(tab);
    }
    // Sadece aktif sekmenin içeriğini kaydet
    if (activeTab && activeTab !== path) {
      const prevTab = findTab(activeTab);
      if (prevTab) {
        prevTab.content = editor.getValue();
        prevTab.dirty = prevTab.content !== prevTab.lastSavedContent;
      }
    }
    activeTab = path;
    renderTabs();
    // Eğer localde içerik varsa onu göster, yoksa sunucudan yükle
    if (tab.content !== null) {
      editor.setValue(tab.content);
      document.getElementById('file-content').dataset.path = path;
      document.getElementById('current-path').textContent = path;
    } else if (window.explorerMode === 'local' || window.explorerMode === 'upload') {
      loadFileContent(path, true); // local cache güncellensin
    } else if (window.explorerMode === 'github') {
      let cleanPath = path;
      while (cleanPath.startsWith('github:')) cleanPath = cleanPath.slice(7);
      if (cleanPath) openGithubFile(cleanPath, false);
    }
  }

  function setActiveTab(path) {
    if (activeTab && activeTab !== path) {
      const prevTab = findTab(activeTab);
      if (prevTab) {
        prevTab.content = editor.getValue();
        prevTab.dirty = prevTab.content !== prevTab.lastSavedContent;
      }
    }
    activeTab = path;
    const tab = findTab(path);
    renderTabs();
    if (tab && tab.content !== null) {
      editor.setValue(tab.content);
      document.getElementById('file-content').dataset.path = path;
      document.getElementById('current-path').textContent = path;
    } else {
      loadFileContent(path, true);
    }
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
    if (!tabsBar) return;
    tabsBar.innerHTML = '';
    openTabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab' + (tab.path === activeTab ? ' active' : '');
      tabEl.textContent = tab.name + (tab.dirty ? ' *' : '');
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
  // GLOBAL DEĞİŞKENLER
  window.explorerMode = 'local';
  window.currentExplorerPath = '/';
  window.uploadedFiles = [];
  window.githubFiles = [];
  window.githubRepoUrl = '';
  // Explorer paneli için DOM elementlerini başta al
  window.explorerBackBtn = document.getElementById('explorer-back');
  window.explorerPathSpan = document.getElementById('explorer-path');
  window.explorerSearch = document.getElementById('explorer-search');

  // Geri butonunun çalışmasını burada bağla
  if (window.explorerBackBtn) {
    window.explorerBackBtn.onclick = function() {
      if (window.currentExplorerPath === '/' || window.currentExplorerPath === '') return;
      const parent = window.currentExplorerPath.replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/';
      loadFiles(parent);
    };
  }
  // window.explorerBackBtn = null;
  // window.explorerPathSpan = null;
  // window.explorerSearch = null;
  window.activityBtns = null;
  window.sidebarPanels = null;
  window.sidebarTitle = null;

  function loadFiles(path = '/') {
    console.log('loadFiles çağrıldı:', path, 'explorerMode:', window.explorerMode);
    if (window.explorerMode === 'upload') {
      showUploadedFiles();
      return;
    }
    if (window.explorerMode === 'github') {
      showGithubFiles();
      return;
    }
    window.currentExplorerPath = path;
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
        if (fileList) {
          fileList.innerHTML = '';
          if (window.explorerPathSpan) window.explorerPathSpan.textContent = path;
          if (window.explorerBackBtn) window.explorerBackBtn.disabled = (path === '/' || path === '');
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
        }
      });
  }
  if (explorerBackBtn) explorerBackBtn.onclick = function() {
    if (window.currentExplorerPath === '/' || window.currentExplorerPath === '') return;
    const parent = window.currentExplorerPath.replace(/\//g, '/').replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/';
    loadFiles(parent);
  };
  if (explorerSearch) explorerSearch.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    fetch(`/api/files?path=${encodeURIComponent(window.currentExplorerPath)}`)
      .then(r => r.json())
      .then(data => {
        const fileList = document.getElementById('file-list');
        if (fileList) {
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
        }
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
  function loadFileContent(path, updateTabContent = false) {
    fetch(`/api/file-content?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(data => {
        // Sadece ilgili sekmenin content'ini güncelle
        const tab = findTab(path);
        if (tab && updateTabContent) {
          tab.content = data.content || '';
          tab.lastSavedContent = data.content || '';
          tab.dirty = false;
        }
        // Eğer şu an aktif sekme buysa editöre yaz
        if (activeTab === path) {
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
          else if (ext === 'swift') mode = 'swift';
          else if (ext === 'java') mode = 'text/x-java';
          else if (ext === 'c') mode = 'text/x-csrc';
          else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'hpp' || ext === 'h') mode = 'text/x-c++src';
          else if (ext === 'go') mode = 'go';
          else if (ext === 'php') mode = 'php';
          else if (ext === 'rb') mode = 'ruby';
          else if (ext === 'rs') mode = 'rust';
          else if (ext === 'ts') mode = 'javascript';
          editor.setOption('mode', mode);
        }
      });
  }

  // Kaydetme fonksiyonunda ilgili tab'ın content ve dirty durumunu güncelle
  function saveFile(showAutoSavedTime = false) {
    const path = document.getElementById('file-content').dataset.path;
    const tab = findTab(path);
    const content = tab ? tab.content : editor.getValue();
    console.log('KAYDET:', path, content); // Debug için
    if (!path || content === undefined || content === null) {
      console.warn('Kaydetme iptal edildi: path veya content eksik.');
      return;
    }
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
      if (tab) {
        tab.lastSavedContent = content;
        tab.dirty = false;
        renderTabs();
      }
      loadFiles(window.currentExplorerPath);
    });
  }
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.onclick = function() {
      if (window.explorerMode === 'github') {
        const path = document.getElementById('current-path').textContent;
        const content = editor.getValue();
        const repo_url = window.githubRepoUrl;
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
  }

  // Terminal
  const terminalForm = document.getElementById('terminal-form');
  const terminalInput = document.getElementById('terminal-input');
  const terminalOutput = document.getElementById('terminal-output');
  // Loading animasyonu için ek div
  let terminalLoading = document.createElement('div');
  terminalLoading.id = 'terminal-loading';
  terminalLoading.style.display = 'none';
  terminalLoading.innerHTML = `<span class='spinner' style='display:inline-block;width:18px;height:18px;border:3px solid #4f8cff;border-top:3px solid transparent;border-radius:50%;animation:spin 1s linear infinite;vertical-align:middle;'></span> <span style='color:#4f8cff;'>Çalışıyor...</span>`;
  if (terminalOutput && terminalOutput.parentNode) terminalOutput.parentNode.insertBefore(terminalLoading, terminalOutput);

  // CSS animasyonu ekle (spin)
  const style = document.createElement('style');
  style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`;
  document.head.appendChild(style);

  if (terminalForm) {
    terminalForm.onsubmit = function(e) {
      e.preventDefault();
      const command = terminalInput.value;
      if (!command) return;
      terminalLoading.style.display = 'block';
      fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      })
      .then(r => r.json())
      .then(data => {
        terminalLoading.style.display = 'none';
        // Satır satır ve kod bloğu olarak göster
        const output = (data.output || data.error || '').replace(/\r?\n/g, '<br>');
        terminalOutput.innerHTML += `<div><span style='color:#4f8cff;'>&gt; ${command}</span></div><div style='margin-bottom:8px;'><code style='white-space:pre-wrap;'>${output}</code></div>`;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        terminalInput.value = '';
      })
      .catch(() => {
        terminalLoading.style.display = 'none';
        terminalOutput.innerHTML += `<div style='color:red;'>Komut çalıştırılırken hata oluştu.</div>`;
      });
    };
  }

  // Source Control (git status)
  const gitStatusBtn = document.getElementById('git-status-btn');
  const gitStatusOutput = document.getElementById('git-status-output');
  if (gitStatusBtn) {
    gitStatusBtn.addEventListener('click', function() {
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
  }

  // Run & Debug (python dosyası çalıştır)
  const runBtn = document.getElementById('run-btn');
  const runOutput = document.getElementById('run-output');
  if (runBtn && runOutput) {
    runBtn.addEventListener('click', function() {
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
  }

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
    if (fileList) {
      fileList.innerHTML = '';
      const tree = buildTree(window.githubFiles);
      renderTree(tree, fileList);
    }
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
  // CodeMirror değişikliklerinde aktif sekmenin içeriğini güncel tut
  if (editor) {
    // Sadece klavye tuşuna basıldığında tetiklenecek
    editor.on('keydown', function() {
      if (window.explorerMode !== 'local' && window.explorerMode !== 'upload') return;
      if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        saveFile(true);
      }, 2000); // 2 saniye boyunca tuşa basılmazsa kaydet
    });
    // Diğer değişikliklerde (örneğin mouse ile) otomatik kaydetme olmasın
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
          window.explorerMode = 'upload';
          // Dosya listesini oluştur
          window.uploadedFiles = Array.from(dirInput.files).map(f => f.webkitRelativePath);
          showUploadedFiles();
        } else {
          alert('Yükleme hatası: ' + (data.error || ''));
        }
      });
    };
  }
  function showUploadedFiles() {
    const fileList = document.getElementById('file-list');
    if (fileList) {
      fileList.innerHTML = '';
      // uploadedFiles: ['src/App.js', 'src/index.js', 'README.md', ...]
      // Önce dosya ağacını oluştur
      const tree = buildTree(window.uploadedFiles.map(path => ({ path })));
      // Github dosya ağacı fonksiyonunu kullanarak göster
      function renderUploadedTree(node, parentUl, parentPath = '') {
        Object.keys(node).forEach(key => {
          if (key === '__file') return;
          const value = node[key];
          const li = document.createElement('li');
          if (value.__file) {
            // Dosya
            li.textContent = key;
            li.style.cursor = 'pointer';
            li.onclick = () => openUploadedFile(value.__file);
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
            renderUploadedTree(value, subUl, parentPath + '/' + key);
            parentUl.appendChild(li);
          }
        });
      }
      renderUploadedTree(tree, fileList);
    }
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
            window.explorerMode = 'github';
            window.githubFiles = data.files;
            window.githubRepoUrl = repoUrl;
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
      body: JSON.stringify({ repo_url: window.githubRepoUrl, path, token })
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
  if (aiOpenBtn && aiCloseBtn) {
    aiOpenBtn.onclick = () => { aiPanel.classList.remove('closed'); };
    aiCloseBtn.onclick = () => { aiPanel.classList.add('closed'); };
  }
  // AI Agent mesajlaşma
  const aiForm = document.getElementById('ai-agent-form');
  const aiInput = document.getElementById('ai-agent-input');
  const aiMessages = document.getElementById('ai-agent-messages');
  if (aiForm && aiInput && aiMessages) {
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
  }

  async function sendAIMessage(message, filePath = null) {
    const aiService = document.getElementById('ai-service');
    const aiApiKey = document.getElementById('ai-api-key');
    const editMode = document.getElementById('edit-mode');

    if (!aiService || !aiApiKey || !editMode) return;

    const res = await fetch('/api/ai-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        file_path: filePath,
        service: aiService.value,
        api_key: aiApiKey.value,
        edit_mode: editMode.value
      })
    });
    return await res.json();
  }

  // Chat paneli mesaj gönderimini bu fonksiyona bağla
  // Örnek:
  const aiAgentSendBtn = document.getElementById('ai-agent-send-btn');
  if (aiAgentSendBtn) {
    aiAgentSendBtn.onclick = async function() {
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
  }

  // --- DİL DESTEĞİ ---
  const translations = {
    tr: {
      save: 'Kaydet',
      userBarLogin: 'Kayıt Ol-Giriş Yap',
      userBarLogout: 'Çıkış',
      dark: 'Koyu',
      light: 'Açık',
      explorer: 'Gezgin',
      source: 'Kaynak Kontrolü',
      run: 'Çalıştır & Hata Ayıklama',
      extensions: 'Uzantılar',
      uploadDir: 'Dizin Yükle',
      githubOpen: 'GitHub\'dan Aç',
      back: 'Geri',
      searchPlaceholder: 'Dosya adı veya yol girin...',
      gitStatus: 'Git Durumu',
      runBtn: 'Çalıştır',
      terminal: 'Terminal',
      terminalShow: 'Terminali Göster',
      aiAgent: 'AI Agent',
      aiAsk: 'AI\'ye sorunuzu sorun...',
      findPlaceholder: 'Aramak istediğiniz metni girin...',
      replacePlaceholder: 'Değiştirmek istediğiniz metni girin...',
      findBtn: 'Sonraki',
      replaceBtn: 'Değiştir',
      replaceAllBtn: 'Tümünü Değiştir',
      foundCount: '{n} bulundu',
      foundNone: 'Bulunamadı',
      foundCountTabs: '{n} sekmede bulundu',
      foundNoneTabs: 'Bulunamadı',
      replacedCountTabs: '{n} sekmede değiştirildi',
      replacedNoneTabs: 'Değiştirilmedi',
      loginUsername: 'Kullanıcı Adı',
      loginPassword: 'Şifre',
      loginBtn: 'Giriş Yap',
      loginError: 'Kullanıcı adı veya şifre hatalı.',
      registerUsername: 'Kullanıcı Adı',
      registerEmail: 'E-posta',
      registerPassword: 'Şifre',
      registerFullname: 'Ad Soyad',
      registerBirthdate: 'Doğum Tarihi',
      registerPasswordConfirm: 'Şifre Tekrar',
      registerBtn: 'Kayıt Ol',
      registerError: 'Kayıt sırasında bir hata oluştu.',
      registerSuccess: 'Kayıt başarılı, şimdi giriş yapabilirsiniz.',
      passwordMismatch: 'Şifreler eşleşmiyor.',
      pricing: {
        title: 'Fiyatlandırma & Paketler',
        desc: 'AI ve Sunucu hizmetlerini ayrı veya avantajlı kombin paketlerle kullanabilirsiniz. Ücretsiz temel editör tüm kullanıcılara açıktır.',
        ai_basic: 'AI Basic',
        ai_pro: 'AI Pro',
        ai_unlimited: 'AI Sınırsız',
        server: 'Sunucu & Terminal',
        ai_pro_server: 'AI Pro + Sunucu & Terminal',
        ai_unlimited_server: 'AI Sınırsız + Sunucu & Terminal',
        price_ai_basic: '5$',
        price_ai_pro: '15$/ay',
        price_ai_unlimited: '25$/ay',
        price_server: '15$/ay',
        price_ai_pro_server: '25$/ay',
        price_ai_unlimited_server: '35$/ay',
        features: {
          ai_basic: [
            'AI Agent paneli (kendi API key\'inle)',
            'Sınırsız AI kullanım (kendi limitle)',
            'Giriş zorunlu'
          ],
          ai_pro: [
            'AI Agent paneli (sistem API key, 500 istek/ay)',
            'Giriş zorunlu'
          ],
          ai_unlimited: [
            'AI Agent paneli (sistem API key, sınırsız istek)',
            'Giriş zorunlu'
          ],
          server: [
            'Sunucu depolama',
            'Gelişmiş terminal erişimi',
            'Giriş zorunlu'
          ],
          ai_pro_server: [
            'AI Agent paneli (sistem API key, 500 istek/ay)',
            'Sunucu depolama',
            'Gelişmiş terminal erişimi',
            'Giriş zorunlu'
          ],
          ai_unlimited_server: [
            'AI Agent paneli (sistem API key, sınırsız istek)',
            'Sunucu depolama',
            'Gelişmiş terminal erişimi',
            'Giriş zorunlu'
          ]
        },
        buy: 'Satın Al',
        note1: 'Ücretli hizmetleri kullanmak için giriş yapmanız gerekmektedir.',
        note2: 'Paket detayları ve satın alma için yakında online ödeme sistemi eklenecektir.',
        pricingBtn: 'Üyelik Planları'
      },
      pricingBtn: 'Üyelik Planları'
    },
    en: {
      save: 'Save',
      userBarLogin: 'Register-Login',
      userBarLogout: 'Logout',
      dark: 'Dark',
      light: 'Light',
      explorer: 'Explorer',
      source: 'Source Control',
      run: 'Run & Debug',
      extensions: 'Extensions',
      uploadDir: 'Upload Directory',
      githubOpen: 'Open from GitHub',
      back: 'Back',
      searchPlaceholder: 'Enter file name or path...',
      gitStatus: 'Git Status',
      runBtn: 'Run',
      terminal: 'Terminal',
      terminalShow: 'Show Terminal',
      aiAgent: 'AI Agent',
      aiAsk: 'Ask AI...',
      findPlaceholder: 'Enter text to search...',
      replacePlaceholder: 'Enter text to replace...',
      findBtn: 'Next',
      replaceBtn: 'Replace',
      replaceAllBtn: 'Replace All',
      foundCount: '{n} found',
      foundNone: 'Not found',
      foundCountTabs: '{n} found in tabs',
      foundNoneTabs: 'Not found',
      replacedCountTabs: '{n} replaced in tabs',
      replacedNoneTabs: 'Not replaced',
      loginUsername: 'Username',
      loginPassword: 'Password',
      loginBtn: 'Login',
      loginError: 'Invalid username or password.',
      registerUsername: 'Username',
      registerEmail: 'Email',
      registerPassword: 'Password',
      registerFullname: 'Full Name',
      registerBirthdate: 'Birthdate',
      registerPasswordConfirm: 'Confirm Password',
      registerBtn: 'Register',
      registerError: 'An error occurred during registration.',
      registerSuccess: 'Registration successful, you can now log in.',
      passwordMismatch: 'Passwords do not match.',
      pricing: {
        title: 'Pricing & Plans',
        desc: 'You can use AI and Server services separately or with advantageous combo packages. The basic editor is free for everyone.',
        ai_basic: 'AI Basic',
        ai_pro: 'AI Pro',
        ai_unlimited: 'AI Unlimited',
        server: 'Server & Terminal',
        ai_pro_server: 'AI Pro + Server & Terminal',
        ai_unlimited_server: 'AI Unlimited + Server & Terminal',
        price_ai_basic: '$5',
        price_ai_pro: '$15/mo',
        price_ai_unlimited: '$25/mo',
        price_server: '$15/mo',
        price_ai_pro_server: '$25/mo',
        price_ai_unlimited_server: '$35/mo',
        features: {
          ai_basic: [
            'AI Agent panel (with your own API key)',
            'Unlimited AI usage (with your own limit)',
            'Login required'
          ],
          ai_pro: [
            'AI Agent panel (system API key, 500 requests/month)',
            'Login required'
          ],
          ai_unlimited: [
            'AI Agent panel (system API key, unlimited requests)',
            'Login required'
          ],
          server: [
            'Server storage',
            'Advanced terminal access',
            'Login required'
          ],
          ai_pro_server: [
            'AI Agent panel (system API key, 500 requests/month)',
            'Server storage',
            'Advanced terminal access',
            'Login required'
          ],
          ai_unlimited_server: [
            'AI Agent panel (system API key, unlimited requests)',
            'Server storage',
            'Advanced terminal access',
            'Login required'
          ]
        },
        buy: 'Buy',
        note1: 'You must be logged in to use paid services.',
        note2: 'Online payment system will be added soon for package details and purchase.',
        pricingBtn: 'Pricing & Plans'
      },
      pricingBtn: 'Pricing & Plans'
    },
    fr: {
      pricingBtn: 'Tarifs & Forfaits',
      save: 'Enregistrer',
      userBarLogin: 'Inscription-Connexion',
      userBarLogout: 'Déconnexion',
      dark: 'Sombre',
      light: 'Clair',
      explorer: 'Explorateur',
      source: 'Contrôle de source',
      run: 'Exécuter & Déboguer',
      extensions: 'Extensions',
      uploadDir: 'Télécharger un dossier',
      githubOpen: 'Ouvrir depuis GitHub',
      back: 'Retour',
      searchPlaceholder: 'Entrez le nom ou le chemin du fichier...',
      gitStatus: 'Statut Git',
      runBtn: 'Exécuter',
      terminal: 'Terminal',
      terminalShow: 'Afficher le terminal',
      findPlaceholder: 'Entrez le texte à rechercher...',
      replacePlaceholder: 'Entrez le texte à remplacer...',
      findBtn: 'Suivant',
      replaceBtn: 'Remplacer',
      replaceAllBtn: 'Tout remplacer',
      foundCount: '{n} trouvé(s)',
      foundNone: 'Aucun trouvé',
      foundCountTabs: '{n} trouvé(s) dans les onglets',
      foundNoneTabs: 'Aucun trouvé',
      replacedCountTabs: '{n} remplacé(s) dans les onglets',
      replacedNoneTabs: 'Aucun remplacé',
      terminalRun: 'Exécuter la commande',
      terminalHeader: 'Terminal',
      terminalShow: 'Afficher le terminal',
      pricing: {
        pricingBtn: 'Tarifs & Forfaits',
        title: 'Tarifs & Forfaits',
        desc: "Vous pouvez utiliser les services d'IA et de serveur séparément ou avec des forfaits combinés avantageux. L'éditeur de base est gratuit pour tous.",
        ai_basic: 'IA Basique',
        ai_pro: 'IA Pro',
        ai_unlimited: 'IA Illimitée',
        server: 'Serveur & Terminal',
        ai_pro_server: 'IA Pro + Serveur & Terminal',
        ai_unlimited_server: 'IA Illimitée + Serveur & Terminal',
        price_ai_basic: '5$',
        price_ai_pro: '15$/mois',
        price_ai_unlimited: '25$/mois',
        price_server: '15$/mois',
        price_ai_pro_server: '25$/mois',
        price_ai_unlimited_server: '35$/mois',
        features: {
          ai_basic: [
            "Panneau IA (avec votre propre clé API)",
            "Utilisation illimitée de l'IA (avec votre propre limite)",
            "Connexion requise"
          ],
          ai_pro: [
            "Panneau IA (clé API système, 500 requêtes/mois)",
            "Connexion requise"
          ],
          ai_unlimited: [
            "Panneau IA (clé API système, requêtes illimitées)",
            "Connexion requise"
          ],
          server: [
            "Stockage serveur",
            "Accès terminal avancé",
            "Connexion requise"
          ],
          ai_pro_server: [
            "Panneau IA (clé API système, 500 requêtes/mois)",
            "Stockage serveur",
            "Accès terminal avancé",
            "Connexion requise"
          ],
          ai_unlimited_server: [
            "Panneau IA (clé API système, requêtes illimitées)",
            "Stockage serveur",
            "Accès terminal avancé",
            "Connexion requise"
          ]
        },
        buy: 'Acheter',
        note1: "Vous devez être connecté pour utiliser les services payants.",
        note2: "Un système de paiement en ligne sera bientôt ajouté pour les détails et l'achat des forfaits.",
        findAllTabsBtn: 'Tout rechercher dans les onglets',
        replaceAllTabsBtn: 'Tout remplacer dans les onglets'
      }
    },
    de: {
      pricingBtn: 'Preise & Pläne',
      save: 'Speichern',
      userBarLogin: 'Registrieren-Anmelden',
      userBarLogout: 'Abmelden',
      dark: 'Dunkel',
      light: 'Hell',
      explorer: 'Explorer',
      source: 'Quellcodeverwaltung',
      run: 'Ausführen & Debuggen',
      extensions: 'Erweiterungen',
      uploadDir: 'Verzeichnis hochladen',
      githubOpen: 'Von GitHub öffnen',
      back: 'Zurück',
      searchPlaceholder: 'Dateiname oder Pfad eingeben...',
      gitStatus: 'Git-Status',
      runBtn: 'Ausführen',
      terminal: 'Terminal',
      terminalShow: 'Terminal anzeigen',
      findPlaceholder: 'Zu suchenden Text eingeben...',
      replacePlaceholder: 'Zu ersetzenden Text eingeben...',
      findBtn: 'Weiter',
      replaceBtn: 'Ersetzen',
      replaceAllBtn: 'Alle ersetzen',
      foundCount: '{n} gefunden',
      foundNone: 'Nicht gefunden',
      foundCountTabs: '{n} in Tabs gefunden',
      foundNoneTabs: 'Nicht gefunden',
      replacedCountTabs: '{n} in Tabs ersetzt',
      replacedNoneTabs: 'Nicht ersetzt',
      terminalRun: 'Befehl ausführen',
      terminalHeader: 'Terminal',
      terminalShow: 'Terminal anzeigen',
      pricing: {
        pricingBtn: 'Preise & Pläne',
        title: 'Preise & Pläne',
        desc: "Sie können KI- und Serverdienste einzeln oder als Vorteilspaket nutzen. Der Basis-Editor ist für alle kostenlos.",
        ai_basic: 'KI Basic',
        ai_pro: 'KI Pro',
        ai_unlimited: 'KI Unbegrenzt',
        server: 'Server & Terminal',
        ai_pro_server: 'KI Pro + Server & Terminal',
        ai_unlimited_server: 'KI Unbegrenzt + Server & Terminal',
        price_ai_basic: '5$',
        price_ai_pro: '15€/Monat',
        price_ai_unlimited: '25€/Monat',
        price_server: '15€/Monat',
        price_ai_pro_server: '25€/Monat',
        price_ai_unlimited_server: '35€/Monat',
        features: {
          ai_basic: [
            "KI-Panel (mit eigenem API-Schlüssel)",
            "Unbegrenzte KI-Nutzung (mit eigenem Limit)",
            "Anmeldung erforderlich"
          ],
          ai_pro: [
            "KI-Panel (System-API-Schlüssel, 500 Anfragen/Monat)",
            "Anmeldung erforderlich"
          ],
          ai_unlimited: [
            "KI-Panel (System-API-Schlüssel, unbegrenzte Anfragen)",
            "Anmeldung erforderlich"
          ],
          server: [
            "Server-Speicher",
            "Erweiterter Terminalzugang",
            "Anmeldung erforderlich"
          ],
          ai_pro_server: [
            "KI-Panel (System-API-Schlüssel, 500 Anfragen/Monat)",
            "Server-Speicher",
            "Erweiterter Terminalzugang",
            "Anmeldung erforderlich"
          ],
          ai_unlimited_server: [
            "KI-Panel (System-API-Schlüssel, unbegrenzte Anfragen)",
            "Server-Speicher",
            "Erweiterter Terminalzugang",
            "Anmeldung erforderlich"
          ]
        },
        buy: 'Kaufen',
        note1: "Für kostenpflichtige Dienste müssen Sie angemeldet sein.",
        note2: "Ein Online-Zahlungssystem wird bald für Paketdetails und Käufe hinzugefügt.",
        findAllTabsBtn: 'In allen Tabs suchen',
        replaceAllTabsBtn: 'In allen Tabs ersetzen'
      }
    },
    es: {
      pricingBtn: 'Precios & Planes',
      save: 'Guardar',
      userBarLogin: 'Registrar-Iniciar sesión',
      userBarLogout: 'Cerrar sesión',
      dark: 'Oscuro',
      light: 'Claro',
      explorer: 'Explorador',
      source: 'Control de código',
      run: 'Ejecutar y depurar',
      extensions: 'Extensiones',
      uploadDir: 'Subir directorio',
      githubOpen: 'Abrir desde GitHub',
      back: 'Atrás',
      searchPlaceholder: 'Ingrese el nombre o ruta del archivo...',
      gitStatus: 'Estado de Git',
      runBtn: 'Ejecutar',
      terminal: 'Terminal',
      terminalShow: 'Mostrar terminal',
      findPlaceholder: 'Ingrese el texto a buscar...',
      replacePlaceholder: 'Ingrese el texto a reemplazar...',
      findBtn: 'Siguiente',
      replaceBtn: 'Reemplazar',
      replaceAllBtn: 'Reemplazar todo',
      foundCount: '{n} encontrado(s)',
      foundNone: 'No encontrado',
      foundCountTabs: '{n} encontrado(s) en pestañas',
      foundNoneTabs: 'No encontrado',
      replacedCountTabs: '{n} reemplazado(s) en pestañas',
      replacedNoneTabs: 'No reemplazado',
      terminalRun: 'Ejecutar comando',
      terminalHeader: 'Terminal',
      terminalShow: 'Mostrar terminal',
      pricing: {
        pricingBtn: 'Precios & Planes',
        title: 'Precios & Planes',
        desc: "Puede utilizar los servicios de IA y servidor por separado o con paquetes combinados ventajosos. El editor básico es gratuito para todos.",
        ai_basic: 'IA Básica',
        ai_pro: 'IA Pro',
        ai_unlimited: 'IA Ilimitada',
        server: 'Servidor & Terminal',
        ai_pro_server: 'IA Pro + Servidor & Terminal',
        ai_unlimited_server: 'IA Ilimitada + Servidor & Terminal',
        price_ai_basic: '5$',
        price_ai_pro: '15$/mes',
        price_ai_unlimited: '25$/mes',
        price_server: '15$/mes',
        price_ai_pro_server: '25$/mes',
        price_ai_unlimited_server: '35$/mes',
        features: {
          ai_basic: [
            "Panel de IA (con tu propia clave API)",
            "Uso ilimitado de IA (con tu propio límite)",
            "Inicio de sesión requerido"
          ],
          ai_pro: [
            "Panel de IA (clave API del sistema, 500 solicitudes/mes)",
            "Inicio de sesión requerido"
          ],
          ai_unlimited: [
            "Panel de IA (clave API del sistema, solicitudes ilimitadas)",
            "Inicio de sesión requerido"
          ],
          server: [
            "Almacenamiento en servidor",
            "Acceso avanzado al terminal",
            "Inicio de sesión requerido"
          ],
          ai_pro_server: [
            "Panel de IA (clave API del sistema, 500 solicitudes/mes)",
            "Almacenamiento en servidor",
            "Acceso avanzado al terminal",
            "Inicio de sesión requerido"
          ],
          ai_unlimited_server: [
            "Panel de IA (clave API del sistema, solicitudes ilimitadas)",
            "Almacenamiento en servidor",
            "Acceso avanzado al terminal",
            "Inicio de sesión requerido"
          ]
        },
        buy: 'Comprar',
        note1: "Debe iniciar sesión para utilizar los servicios de pago.",
        note2: "Pronto se añadirá un sistema de pago en línea para detalles y compras de paquetes.",
        findAllTabsBtn: 'Buscar en todas las pestañas',
        replaceAllTabsBtn: 'Reemplazar en todas las pestañas'
      }
    },
    zh: {
      pricingBtn: '定价与套餐',
      save: '保存',
      userBarLogin: '注册-登录',
      userBarLogout: '登出',
      dark: '深色',
      light: '浅色',
      explorer: '资源管理器',
      source: '源代码管理',
      run: '运行和调试',
      extensions: '扩展',
      uploadDir: '上传目录',
      githubOpen: '从GitHub打开',
      back: '返回',
      searchPlaceholder: '输入文件名或路径...',
      gitStatus: 'Git状态',
      runBtn: '运行',
      terminal: '终端',
      terminalShow: '显示终端',
      findPlaceholder: '输入要搜索的文本...',
      replacePlaceholder: '输入要替换的文本...',
      findBtn: '下一个',
      replaceBtn: '替换',
      replaceAllBtn: '全部替换',
      foundCount: '找到{n}个',
      foundNone: '未找到',
      foundCountTabs: '在标签中找到{n}个',
      foundNoneTabs: '未找到',
      replacedCountTabs: '在标签中替换了{n}个',
      replacedNoneTabs: '未替换',
      terminalRun: '运行命令',
      terminalHeader: '终端',
      terminalShow: '显示终端',
      pricing: {
        pricingBtn: '定价与套餐',
        title: '定价与套餐',
        desc: "您可以单独或通过优惠组合套餐使用AI和服务器服务。基础编辑器对所有人免费开放。",
        ai_basic: 'AI基础',
        ai_pro: 'AI专业',
        ai_unlimited: 'AI无限',
        server: '服务器与终端',
        ai_pro_server: 'AI专业+服务器与终端',
        ai_unlimited_server: 'AI无限+服务器与终端',
        price_ai_basic: '5$',
        price_ai_pro: '15$/月',
        price_ai_unlimited: '25$/月',
        price_server: '15$/月',
        price_ai_pro_server: '25$/月',
        price_ai_unlimited_server: '35$/月',
        features: {
          ai_basic: [
            "AI面板（使用您自己的API密钥）",
            "无限AI使用（受您自己的限制）",
            "需要登录"
          ],
          ai_pro: [
            "AI面板（系统API密钥，每月500次请求）",
            "需要登录"
          ],
          ai_unlimited: [
            "AI面板（系统API密钥，无限请求）",
            "需要登录"
          ],
          server: [
            "服务器存储",
            "高级终端访问",
            "需要登录"
          ],
          ai_pro_server: [
            "AI面板（系统API密钥，每月500次请求）",
            "服务器存储",
            "高级终端访问",
            "需要登录"
          ],
          ai_unlimited_server: [
            "AI面板（系统API密钥，无限请求）",
            "服务器存储",
            "高级终端访问",
            "需要登录"
          ]
        },
        buy: '购买',
        note1: "您必须登录才能使用付费服务。",
        note2: "即将添加在线支付系统以获取套餐详情和购买。",
        findAllTabsBtn: '在所有标签中查找',
        replaceAllTabsBtn: '在所有标签中替换'
      }
    },
    hi: {
      pricingBtn: 'मूल्य निर्धारण और योजनाएँ',
      save: 'सहेजें',
      userBarLogin: 'रजिस्टर-लॉगिन',
      userBarLogout: 'लॉगआउट',
      dark: 'गहरा',
      light: 'हल्का',
      explorer: 'एक्सप्लोरर',
      source: 'सोर्स कंट्रोल',
      run: 'चलाएँ और डिबग करें',
      extensions: 'एक्सटेंशन',
      uploadDir: 'डायरेक्टरी अपलोड करें',
      githubOpen: 'GitHub से खोलें',
      back: 'वापस',
      searchPlaceholder: 'फ़ाइल नाम या पथ दर्ज करें...',
      gitStatus: 'Git स्थिति',
      runBtn: 'चलाएँ',
      terminal: 'टर्मिनल',
      terminalShow: 'टर्मिनल दिखाएँ',
      findPlaceholder: 'खोजने के लिए पाठ दर्ज करें...',
      replacePlaceholder: 'बदलने के लिए पाठ दर्ज करें...',
      findBtn: 'अगला',
      replaceBtn: 'बदलें',
      replaceAllBtn: 'सभी बदलें',
      foundCount: '{n} मिला',
      foundNone: 'कुछ नहीं मिला',
      foundCountTabs: '{n} टैब में मिला',
      foundNoneTabs: 'कुछ नहीं मिला',
      replacedCountTabs: '{n} टैब में बदला गया',
      replacedNoneTabs: 'कोई बदलाव नहीं',
      terminalRun: 'कमांड चलाएँ',
      terminalHeader: 'टर्मिनल',
      terminalShow: 'टर्मिनल दिखाएँ',
      pricing: {
        pricingBtn: 'मूल्य निर्धारण और योजनाएँ',
        title: 'मूल्य निर्धारण और योजनाएँ',
        desc: "आप AI और सर्वर सेवाओं का उपयोग अलग-अलग या लाभकारी संयोजन पैकेजों के साथ कर सकते हैं। बेसिक एडिटर सभी के लिए निःशुल्क है।",
        ai_basic: 'AI बेसिक',
        ai_pro: 'AI प्रो',
        ai_unlimited: 'AI अनलिमिटेड',
        server: 'सर्वर और टर्मिनल',
        ai_pro_server: 'AI प्रो + सर्वर और टर्मिनल',
        ai_unlimited_server: 'AI अनलिमिटेड + सर्वर और टर्मिनल',
        price_ai_basic: '5$',
        price_ai_pro: '15$/माह',
        price_ai_unlimited: '25$/माह',
        price_server: '15$/माह',
        price_ai_pro_server: '25$/माह',
        price_ai_unlimited_server: '35$/माह',
        features: {
          ai_basic: [
            "AI पैनल (अपने स्वयं के API कुंजी के साथ)",
            "असीमित AI उपयोग (अपने स्वयं के लिमिट के साथ)",
            "लॉगिन आवश्यक"
          ],
          ai_pro: [
            "AI पैनल (सिस्टम API कुंजी, 500 अनुरोध/माह)",
            "लॉगिन आवश्यक"
          ],
          ai_unlimited: [
            "AI पैनल (सिस्टम API कुंजी, असीमित अनुरोध)",
            "लॉगिन आवश्यक"
          ],
          server: [
            "सर्वर स्टोरेज",
            "एडवांस्ड टर्मिनल एक्सेस",
            "लॉगिन आवश्यक"
          ],
          ai_pro_server: [
            "AI पैनल (सिस्टम API कुंजी, 500 अनुरोध/माह)",
            "सर्वर स्टोरेज",
            "एडवांस्ड टर्मिनल एक्सेस",
            "लॉगिन आवश्यक"
          ],
          ai_unlimited_server: [
            "AI पैनल (सिस्टम API कुंजी, असीमित अनुरोध)",
            "सर्वर स्टोरेज",
            "एडवांस्ड टर्मिनल एक्सेस",
            "लॉगिन आवश्यक"
          ]
        },
        buy: 'खरीदें',
        note1: "पेड सेवाओं का उपयोग करने के लिए आपको लॉगिन करना होगा।",
        note2: "पैकेज विवरण और खरीद के लिए जल्द ही ऑनलाइन भुगतान प्रणाली जोड़ी जाएगी।",
        findAllTabsBtn: 'सभी टैब में खोजें',
        replaceAllTabsBtn: 'सभी टैब में बदलें'
      }
    }
  };
  window.translations = translations;

  function updatePricingModalLang(lang) {
    // DÜZELTME: Çeviri nesnesini doğru al
    const t = (translations[lang] && translations[lang].pricing) ? translations[lang].pricing : (translations['en'] && translations['en'].pricing) ? translations['en'].pricing : {};
    const modal = document.getElementById('pricing-modal');
    if (!modal) return;
    // Başlık ve açıklama
    const title = modal.querySelector('.pricing-title');
    if (title) title.innerHTML = `<i class="fa-solid fa-cubes"></i> ${t.title}`;
    const desc = modal.querySelector('.pricing-desc');
    if (desc) desc.textContent = t.desc;
    // Kartlar
    const cardKeys = ['ai_basic','ai_pro','ai_unlimited','server','ai_pro_server','ai_unlimited_server'];
    const priceKeys = ['price_ai_basic','price_ai_pro','price_ai_unlimited','price_server','price_ai_pro_server','price_ai_unlimited_server'];
    const cards = modal.querySelectorAll('.pricing-card');
    cards.forEach((card, i) => {
      const planTitle = card.querySelector('.plan-title');
      if (planTitle) planTitle.textContent = t[cardKeys[i]];
      const planPrice = card.querySelector('.plan-price');
      if (planPrice) planPrice.textContent = t[priceKeys[i]];
      const ul = card.querySelector('ul');
      if (ul) {
        ul.innerHTML = '';
        const features = t.features && t.features[cardKeys[i]];
        if (features && Array.isArray(features)) {
          features.forEach(f => {
            ul.innerHTML += `<li><i class='fa-solid fa-check'></i> ${f}</li>`;
          });
        }
      }
      const btn = card.querySelector('.plan-action button');
      if (btn) btn.textContent = t.buy;
    });
    // Notlar
    const notes = modal.querySelectorAll('.note');
    if (notes && notes[0]) {
      notes[0].innerHTML = `<i class="fa-solid fa-info-circle"></i> ${t.note1}<br><i class="fa-solid fa-info-circle"></i> ${t.note2}`;
    }
  }

  // setLanguage fonksiyonuna ekle
  function setLanguage(lang) {
    localStorage.setItem('lang', lang);
    currentLang = lang;
    const t = (translations[lang] && typeof translations[lang] === 'object') ? translations[lang] : translations['en'];
    // Header
    if (saveBtn) saveBtn.innerHTML = `<i class="fa-regular fa-floppy-disk"></i> ${t.save}`;
    if (themeToggle) {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      const themeToggleIcon = document.getElementById('theme-toggle-icon');
      if (themeToggleIcon) themeToggleIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
      themeToggle.innerHTML = `<span id="theme-toggle-icon">${theme === 'dark' ? '☀️' : '🌙'}</span> ${theme === 'dark' ? t.light : t.dark}`;
    }
    // Explorer başlığı
    if (sidebarTitle) sidebarTitle.textContent = t.explorer;
    // Activitybar ikonları
    if (window.activityBtns && window.activityBtns.length >= 4) {
      window.activityBtns[0].title = t.explorer;
      window.activityBtns[1].title = t.source;
      window.activityBtns[2].title = t.run;
      window.activityBtns[3].title = t.extensions;
    }
    // --- YENİ: Butonlar ve panelleri her dil değişiminde güncelle ---
    window.activityBtns = document.querySelectorAll('.activity-btn');
    // Hem çevirili hem İngilizce title ile eşleşme için iki anahtar ekle
    window.sidebarPanels = {
      [t.explorer]: document.getElementById('sidebar-explorer'),
      'Explorer': document.getElementById('sidebar-explorer'),
      [t.source]: document.getElementById('sidebar-source'),
      'Source Control': document.getElementById('sidebar-source'),
      [t.run]: document.getElementById('sidebar-run'),
      'Run & Debug': document.getElementById('sidebar-run'),
      [t.extensions]: document.getElementById('sidebar-extensions'),
      'Extensions': document.getElementById('sidebar-extensions')
    };
    window.sidebarTitle = document.getElementById('sidebar-title');
    // Explorer butonları
    if (uploadDirBtn) uploadDirBtn.innerHTML = `<i class="fa-solid fa-folder-open"></i> ${t.uploadDir}`;
    if (githubOpenBtn) githubOpenBtn.innerHTML = `<i class="fa-brands fa-github"></i> ${t.githubOpen}`;
    if (explorerBackBtn) explorerBackBtn.title = t.back;
    if (explorerSearch) explorerSearch.placeholder = t.searchPlaceholder;
    // Source Control
    if (gitStatusBtn) gitStatusBtn.innerHTML = `<i class="fa-solid fa-code-branch"></i> ${t.gitStatus}`;
    // Run & Debug
    if (runBtn) runBtn.innerHTML = `<i class="fa-solid fa-play"></i> ${t.runBtn}`;
    // Terminal
    const terminalHeaderSpan = document.querySelector('.terminal-header span');
    if (terminalHeaderSpan) terminalHeaderSpan.innerHTML = `<i class="fa-solid fa-terminal"></i> ${t.terminal}`;
    if (terminalInput) terminalInput.placeholder = t.terminalRun;
    const terminalFormSubmitBtn = document.querySelector('#terminal-form button[type="submit"]');
    if (terminalFormSubmitBtn) terminalFormSubmitBtn.textContent = t.terminalRun;
    if (showTerminalBtn) showTerminalBtn.innerHTML = `<i class="fa-solid fa-terminal"></i> ${t.terminalShow}`;
    // AI Agent
    const aiAgentHeaderSpan = document.querySelector('#ai-agent-header span');
    if (aiAgentHeaderSpan) aiAgentHeaderSpan.innerHTML = `<i class="fa-solid fa-robot"></i> ${t.aiAgent}`;
    if (aiInput) aiInput.placeholder = t.aiAsk;
    if (aiOpenBtn) aiOpenBtn.innerHTML = `<i class="fa-solid fa-robot"></i> AI`;
    // AI paneli butonları ve ayarları
    const aiFormBtn = document.querySelector('#ai-agent-form button[type="submit"]');
    if (aiFormBtn) aiFormBtn.title = t.aiAsk;
    // AI ayar paneli label'ları
    const aiSettings = document.getElementById('ai-settings');
    if (aiSettings) {
      const labels = aiSettings.querySelectorAll('label');
      if (labels.length >= 3) {
        labels[0].childNodes[0].textContent = t.aiAgent + ' / Model:';
        labels[1].childNodes[0].textContent = 'API Key:';
        labels[2].childNodes[0].textContent = 'Edit Mode:';
      }
    }
    // Find & Replace paneli çevirileri
    const findInput = document.getElementById('find-input');
    const replaceInput = document.getElementById('replace-input');
    const findNextBtn = document.getElementById('find-next-btn');
    const replaceBtn = document.getElementById('replace-btn');
    const replaceAllBtn = document.getElementById('replace-all-btn');
    
    if (findInput) findInput.placeholder = t.findPlaceholder;
    if (replaceInput) replaceInput.placeholder = t.replacePlaceholder;
    if (findNextBtn) findNextBtn.textContent = t.findBtn;
    if (replaceBtn) replaceBtn.textContent = t.replaceBtn;
    if (replaceAllBtn) replaceAllBtn.textContent = t.replaceAllBtn;
    
    // Tüm sekmelerde bul/değiştir butonları
    const findAllTabsBtn = document.getElementById('find-all-tabs-btn');
    const replaceAllTabsBtn = document.getElementById('replace-all-tabs-btn');
    if (findAllTabsBtn) findAllTabsBtn.textContent = t.findAllTabsBtn;
    if (replaceAllTabsBtn) replaceAllTabsBtn.textContent = t.replaceAllTabsBtn;
    
    attachActivityBtnHandlers();
    // Kullanıcı barı çevirileri (varsa)
    checkUserStatus(); // Çeviri güncellendikten sonra barı güncelle

    // Auth modal çevirileri
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const loginBtn = document.getElementById('login-btn');
    const registerUsername = document.getElementById('register-username');
          const registerEmail = document.getElementById('register-email');
      const registerPassword = document.getElementById('register-password');
      const registerFullname = document.getElementById('register-fullname');
      const registerBirthdate = document.getElementById('register-birthdate');
      const registerPasswordConfirm = document.getElementById('register-password-confirm');
      const registerBtn = document.getElementById('register-btn');
      const authLoginTab = document.getElementById('auth-login-tab');
    const authRegisterTab = document.getElementById('auth-register-tab');
    if (loginUsername) loginUsername.placeholder = t.loginUsername;
    if (loginPassword) loginPassword.placeholder = t.loginPassword;
    if (loginBtn) loginBtn.textContent = t.loginBtn;
    if (registerUsername) registerUsername.placeholder = t.registerUsername;
          if (registerEmail) registerEmail.placeholder = t.registerEmail;
      if (registerPassword) registerPassword.placeholder = t.registerPassword;
      if (registerFullname) registerFullname.placeholder = t.registerFullname;
      if (registerBirthdate) registerBirthdate.placeholder = t.registerBirthdate;
      if (registerPasswordConfirm) registerPasswordConfirm.placeholder = t.registerPasswordConfirm;
      if (registerBtn) registerBtn.textContent = t.registerBtn;
      if (authLoginTab) authLoginTab.textContent = t.loginTab;
    if (authRegisterTab) authRegisterTab.textContent = t.registerTab;
    // Pricing modalı da güncelle
    updatePricingModalLang(lang);
  }

  // Dil seçici ve otomatik uygulama
  const langSelect = document.getElementById('lang-select');
  function applyLanguageOnLoad() {
    let lang = localStorage.getItem('lang');
    // Eğer hiç seçim yapılmadıysa veya geçersizse, varsayılanı Türkçe yap
    if (!lang || !translations[lang]) lang = 'tr';
    if (langSelect) {
      langSelect.value = lang;
      lang = langSelect.value;
    }
    if (typeof setLanguage === 'function') setLanguage(lang);
  }
  if (langSelect) {
    langSelect.onchange = function() {
      if (typeof setLanguage === 'function') setLanguage(this.value);
    };
  }
  applyLanguageOnLoad();

  // CodeMirror simplemode hatası için (kullanılıyorsa):
  // Eğer aşağıdaki gibi bir satır varsa yoruma alın:
  // CodeMirror.defineSimpleMode ...
  // veya
  //.defineSimpleMode ...
  // (Kullanılmıyorsa bu kısmı atlayın)

  // --- FIND & REPLACE PANEL ---
  const findInput = document.getElementById('find-input');
  const replaceInput = document.getElementById('replace-input');
  const findNextBtn = document.getElementById('find-next-btn');
  const replaceBtn = document.getElementById('replace-btn');
  const replaceAllBtn = document.getElementById('replace-all-btn');
  const findAllTabsBtn = document.getElementById('find-all-tabs-btn');
  const replaceAllTabsBtn = document.getElementById('replace-all-tabs-btn');

  // Arama highlight'larını temizle
  function clearSearchHighlights() {
    if (editor) {
      editor.getAllMarks().forEach(mark => {
        if (mark.className === 'CodeMirror-searching') {
          mark.clear();
        }
      });
    }
    // Eşleşme sayısını sıfırla
    const findCount = document.getElementById('find-count');
    if (findCount) findCount.textContent = '';
  }

  // Arama yap ve highlight'ları göster, eşleşme sayısını yaz
  function performSearch(query) {
    const findCount = document.getElementById('find-count');
    if (!editor || !query) {
      clearSearchHighlights();
      if (findCount) findCount.textContent = '';
      return;
    }
    clearSearchHighlights();
    let count = 0;
    const cursor = editor.getSearchCursor(query);
    while (cursor.findNext()) {
      editor.markText(cursor.from(), cursor.to(), {
        className: 'CodeMirror-searching'
      });
      count++;
    }
    if (findCount) {
      // Dil desteği
      const t = window.translations && window.translations[currentLang] ? window.translations[currentLang] : window.translations['en'];
      findCount.textContent = count > 0 ? t.foundCount.replace('{n}', count) : t.foundNone;
    }
  }

  if (findInput) {
    // Arama kutusuna yazıldığında anında arama yap
    findInput.addEventListener('input', function() {
      performSearch(this.value);
    });

    // Arama kutusundan çıkınca highlight'ları temizle
    findInput.addEventListener('blur', function() {
      if (!this.value) {
        clearSearchHighlights();
      }
    });
  }

  if (findNextBtn) {
    findNextBtn.onclick = function() {
      const query = findInput.value;
      if (!query) return;
      
      // Önce highlight'ları temizle
      clearSearchHighlights();
      
      const cursor = editor.getSearchCursor(query, editor.getCursor());
      if (cursor.findNext()) {
        editor.setSelection(cursor.from(), cursor.to());
        editor.scrollIntoView({from: cursor.from(), to: cursor.to()});
        // Seçili olanı highlight et
        editor.markText(cursor.from(), cursor.to(), {
          className: 'CodeMirror-searching'
        });
      } else {
        // Baştan ara
        const cursor2 = editor.getSearchCursor(query, {line:0, ch:0});
        if (cursor2.findNext()) {
          editor.setSelection(cursor2.from(), cursor2.to());
          editor.scrollIntoView({from: cursor2.from(), to: cursor2.to()});
          editor.markText(cursor2.from(), cursor2.to(), {
            className: 'CodeMirror-searching'
          });
        }
      }
    };
  }
  if (replaceBtn) {
    replaceBtn.onclick = function() {
      const query = findInput.value;
      const replaceWith = replaceInput.value;
      if (!query) return;
      const cursor = editor.getSearchCursor(query, editor.getCursor());
      if (cursor.findNext()) {
        editor.setSelection(cursor.from(), cursor.to());
        editor.replaceSelection(replaceWith);
        // Highlight'ları güncelle
        performSearch(query);
      }
    };
  }
  if (replaceAllBtn) {
    replaceAllBtn.onclick = function() {
      const query = findInput.value;
      const replaceWith = replaceInput.value;
      if (!query) return;
      editor.operation(function() {
        const cursor = editor.getSearchCursor(query, {line:0, ch:0});
        while (cursor.findNext()) {
          cursor.replace(replaceWith);
        }
      });
      // Highlight'ları temizle
      clearSearchHighlights();
    };
  }

  // Tüm sekmelerde bul
  if (findAllTabsBtn) {
    findAllTabsBtn.onclick = function() {
      const query = findInput.value;
      if (!query) return;
      let total = 0;
      openTabs.forEach(tab => {
        if (tab.content !== null) {
          let count = 0;
          const doc = new window.CodeMirror.Doc(tab.content);
          const cursor = doc.getSearchCursor(query);
          while (cursor.findNext()) count++;
          total += count;
        }
      });
      const findCount = document.getElementById('find-count');
      const t = window.translations && window.translations[currentLang] ? window.translations[currentLang] : window.translations['en'];
      findCount.textContent = total > 0 ? t.foundCountTabs.replace('{n}', total) : t.foundNoneTabs;
    };
  }

  // Tüm sekmelerde değiştir
  if (replaceAllTabsBtn) {
    replaceAllTabsBtn.onclick = function() {
      const query = findInput.value;
      const replaceWith = replaceInput.value;
      if (!query) return;
      let total = 0;
      openTabs.forEach(tab => {
        if (tab.content !== null) {
          let count = 0;
          let doc = new window.CodeMirror.Doc(tab.content);
          doc.operation(function() {
            const cursor = doc.getSearchCursor(query, {line:0, ch:0});
            while (cursor.findNext()) {
              cursor.replace(replaceWith);
              count++;
            }
          });
          if (count > 0) {
            tab.content = doc.getValue();
            tab.dirty = true;
            total += count;
            // Eğer aktif sekme ise editörü de güncelle
            if (activeTab === tab.path) {
              editor.setValue(tab.content);
            }
          }
        }
      });
      const findCount = document.getElementById('find-count');
      const t = window.translations && window.translations[currentLang] ? window.translations[currentLang] : window.translations['en'];
      findCount.textContent = total > 0 ? t.replacedCountTabs.replace('{n}', total) : t.replacedNoneTabs;
    };
  }

  // Ctrl+F kısayolu ekle
  if (findInput) {
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        findInput.focus();
        findInput.select();
      }
    });
  }

  // --- ÜYELİK MODALI ---
  const authModal = document.getElementById('auth-modal');
  const authModalClose = document.getElementById('auth-modal-close');
  const authLoginTab = document.getElementById('auth-login-tab');
  const authRegisterTab = document.getElementById('auth-register-tab');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');

  // Modal aç/kapa fonksiyonları
  function openAuthModal(tab = 'login') {
    const authModal = document.getElementById('auth-modal');
    const authLoginTab = document.getElementById('auth-login-tab');
    const authRegisterTab = document.getElementById('auth-register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    if (authModal) authModal.style.display = 'flex';
    // Sekme aktifliğini ve stilleri güncelle
    if (authLoginTab) authLoginTab.classList.remove('active');
    if (authRegisterTab) authRegisterTab.classList.remove('active');
    if (tab === 'login') {
      if (authLoginTab) authLoginTab.classList.add('active');
      if (loginForm) loginForm.style.display = 'block';
      if (registerForm) registerForm.style.display = 'none';
    } else {
      if (authRegisterTab) authRegisterTab.classList.add('active');
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
    }
    if (loginError) loginError.textContent = '';
    if (registerError) registerError.textContent = '';
  }
  window.openAuthModal = openAuthModal;
  function closeAuthModal() {
    console.log('closeAuthModal çağrıldı');
    if (authModal) authModal.style.display = 'none';
  }
  if (authModalClose) {
    authModalClose.onclick = function() {
      console.log('çarpı tıklandı');
      closeAuthModal();
    };
  }
  if (authLoginTab) authLoginTab.onclick = () => {
    openAuthModal('login');
    if (authLoginTab) authLoginTab.classList.add('active');
    if (authRegisterTab) authRegisterTab.classList.remove('active');
  };
  if (authRegisterTab) authRegisterTab.onclick = () => {
    openAuthModal('register');
    if (authLoginTab) authLoginTab.classList.remove('active');
    if (authRegisterTab) authRegisterTab.classList.add('active');
  };
  // Modal dışında tıklayınca kapat
  if (authModal) {
    authModal.addEventListener('click', function(e) {
      if (e.target === authModal) closeAuthModal();
    });
  }

  // Giriş formu
  if (loginForm) {
    loginForm.onsubmit = function(e) {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const t = window.translations && window.translations[currentLang] ? window.translations[currentLang] : window.translations['en'];
      if (!username || !password) {
        if (loginError) {
          loginError.textContent = t.loginError;
          loginError.classList.add('has-error');
        }
        return;
      }
      fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          closeAuthModal();
          checkUserStatus();
        } else {
          if (loginError) {
            loginError.textContent = data.error || t.loginError;
            loginError.classList.add('has-error');
          }
        }
      });
    };
  }
  if (registerForm) {
    registerForm.onsubmit = function(e) {
      e.preventDefault();
      const username = document.getElementById('register-username').value.trim();
      const fullname = document.getElementById('register-fullname').value.trim();
      const birthdate = document.getElementById('register-birthdate').value;
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const passwordConfirm = document.getElementById('register-password-confirm').value;
      const t = window.translations && window.translations[currentLang] ? window.translations[currentLang] : window.translations['en'];
      
      if (!username || !email || !password) {
        if (registerError) {
          registerError.textContent = t.registerError;
          registerError.classList.add('has-error');
        }
        return;
      }
      
      if (password !== passwordConfirm) {
        if (registerError) {
          registerError.textContent = t.passwordMismatch || 'Şifreler eşleşmiyor';
          registerError.classList.add('has-error');
        }
        return;
      }
      
      fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, fullname, birthdate, password, password_confirm: passwordConfirm })
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          openAuthModal('login');
          if (registerError) {
            registerError.textContent = t.registerSuccess || 'Kayıt başarılı, şimdi giriş yapabilirsiniz.';
            registerError.classList.add('has-error');
          }
        } else {
          if (registerError) {
            registerError.textContent = data.error || t.registerError;
            registerError.classList.add('has-error');
          }
        }
      });
    };
  }
  // Sekme değişiminde hata mesajlarını gizle
  function hideAuthErrors() {
    if (loginError) {
      loginError.textContent = '';
      loginError.classList.remove('has-error');
      loginError.style.display = 'none';
    }
    if (registerError) {
      registerError.textContent = '';
      registerError.classList.remove('has-error');
      registerError.style.display = 'none';
    }
  }
  if (authLoginTab) authLoginTab.addEventListener('click', hideAuthErrors);
  if (authRegisterTab) authRegisterTab.addEventListener('click', hideAuthErrors);

  // Hata mesajı varsa göster, yoksa gizle
  function showError(div, msg) {
    if (div) {
      if (msg) {
        div.textContent = msg;
        div.classList.add('has-error');
        div.style.display = 'block';
      } else {
        div.textContent = '';
        div.classList.remove('has-error');
        div.style.display = 'none';
      }
    }
  }

  // Kullanıcı durumu kontrolü ve üstte gösterme
  function checkUserStatus() {
    console.log('checkUserStatus çağrıldı');
    let userBar = document.getElementById('user-bar');
    if (!userBar) return;
    userBar.innerHTML = '';
    // Üyelik Planları butonu
    const planLink = document.createElement('a');
    planLink.href = '/pricing';
    planLink.id = 'pricing-link';
    planLink.innerHTML = `<i class='fa-solid fa-crown'></i> ${window.translations[currentLang]?.pricingBtn || window.translations[currentLang]?.pricing?.pricingBtn || 'Üyelik Planları'}`;
    planLink.style.background = '#fff';
    planLink.style.color = 'var(--vscode-accent)';
    planLink.style.border = 'none';
    planLink.style.borderRadius = '12px';
    planLink.style.padding = '4px 16px';
    planLink.style.minWidth = '110px';
    planLink.style.cursor = 'pointer';
    planLink.style.fontSize = '0.95em';
    planLink.style.textDecoration = 'none';
    planLink.style.marginRight = '8px';
    planLink.onclick = function(e) {
      e.preventDefault();
      const modal = document.getElementById('pricing-modal');
      if (modal) {
        modal.style.display = 'flex';
        if (typeof updatePricingModalLang === 'function') updatePricingModalLang(currentLang);
      } else {
        window.location.href = '/pricing';
      }
    };
    userBar.appendChild(planLink);
    fetch('/api/user')
      .then(r => r.json())
      .then(data => {
        if (data.logged_in) {
          // Kullanıcı adı ve çıkış butonu
          const userSpan = document.createElement('span');
          userSpan.innerHTML = `<i class='fa-solid fa-user'></i> <span style='margin-right:8px;'>${data.username}</span>`;
          userBar.appendChild(userSpan);

          const logoutBtn = document.createElement('button');
          logoutBtn.id = 'logout-btn';
          logoutBtn.textContent = window.translations[currentLang]?.userBarLogout || 'Çıkış';
          logoutBtn.style.background = '#fff';
          logoutBtn.style.color = 'var(--vscode-accent)';
          logoutBtn.style.border = 'none';
          logoutBtn.style.borderRadius = '12px';
          logoutBtn.style.padding = '4px 16px';
          logoutBtn.style.minWidth = '70px';
          logoutBtn.style.cursor = 'pointer';
          logoutBtn.style.fontSize = '0.95em';
          logoutBtn.onclick = function() {
            fetch('/api/logout', { method: 'POST' })
              .then(r => r.json())
              .then(() => {
                checkUserStatus();
              });
          };
          userBar.appendChild(logoutBtn);
        } else {
          // Giriş yap butonu
          const openAuthBtn = document.createElement('button');
          openAuthBtn.id = 'open-auth-btn';
          openAuthBtn.innerHTML = `<i class='fa-solid fa-user'></i> ${window.translations[currentLang]?.userBarLogin || 'Kayıt Ol-Giriş Yap'}`;
          openAuthBtn.style.background = '#fff';
          openAuthBtn.style.color = 'var(--vscode-accent)';
          openAuthBtn.style.border = 'none';
          openAuthBtn.style.borderRadius = '12px';
          openAuthBtn.style.padding = '4px 16px';
          openAuthBtn.style.minWidth = '110px';
          openAuthBtn.style.cursor = 'pointer';
          openAuthBtn.style.fontSize = '0.95em';
          openAuthBtn.onclick = function(e) {
            e.preventDefault();
            if (typeof openAuthModal === 'function') openAuthModal('login');
          };
          userBar.appendChild(openAuthBtn);
        }
        console.log('checkUserStatus bitti');
      });
  }

  // Sosyal giriş butonları
  const googleLoginBtn = document.getElementById('google-login-btn');
  const githubLoginBtn = document.getElementById('github-login-btn');

  // OAuth durumunu kontrol et ve butonları ayarla
  fetch('/api/oauth-status')
    .then(r => r.json())
    .then(data => {
      if (googleLoginBtn) {
        if (data.google_enabled) {
          googleLoginBtn.onclick = function() {
            window.location.href = '/auth/google';
          };
        } else {
          googleLoginBtn.disabled = true;
          googleLoginBtn.title = 'Google OAuth yapılandırılmamış';
          googleLoginBtn.style.opacity = '0.5';
        }
      }
      
      if (githubLoginBtn) {
        if (data.github_enabled) {
          githubLoginBtn.onclick = function() {
            window.location.href = '/auth/github';
          };
        } else {
          githubLoginBtn.disabled = true;
          githubLoginBtn.title = 'GitHub OAuth yapılandırılmamış';
          githubLoginBtn.style.opacity = '0.5';
        }
      }
    })
    .catch(err => {
      console.log('OAuth durumu kontrol edilemedi:', err);
      // Hata durumunda butonları devre dışı bırak
      if (googleLoginBtn) {
        googleLoginBtn.disabled = true;
        googleLoginBtn.title = 'Google OAuth yapılandırılmamış';
        googleLoginBtn.style.opacity = '0.5';
      }
      if (githubLoginBtn) {
        githubLoginBtn.disabled = true;
        githubLoginBtn.title = 'GitHub OAuth yapılandırılmamış';
        githubLoginBtn.style.opacity = '0.5';
      }
    });

  // Üyelik Planları modal aç/kapa
  var planLink = document.getElementById('pricing-link');
  const pricingModal = document.getElementById('pricing-modal');
  const pricingModalClose = document.getElementById('pricing-modal-close');
  if (planLink && pricingModal && pricingModalClose) {
    planLink.onclick = function(e) {
      e.preventDefault();
      pricingModal.style.display = 'flex';
    };
    pricingModalClose.onclick = function() {
      pricingModal.style.display = 'none';
    };
    pricingModal.addEventListener('click', function(e) {
      if (e.target === pricingModal) pricingModal.style.display = 'none';
    });
  }

  // Modal açıldığında da güncel dilde göster
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      const planLink = document.getElementById('pricing-link');
      if (planLink) {
        planLink.addEventListener('click', function() {
          updatePricingModalLang(currentLang);
        });
      }
    });
  }

  // Giriş yap butonuna event bağla
  const openAuthBtn = document.getElementById('open-auth-btn');
  if (openAuthBtn) {
    openAuthBtn.onclick = function(e) {
      e.preventDefault();
      if (typeof openAuthModal === 'function') openAuthModal('login');
    };
  }

  // Üyelik Planları butonuna modal açma eventini bağla
  var planLink = document.getElementById('pricing-link');
  if (planLink) {
    planLink.onclick = function(e) {
      e.preventDefault();
      const modal = document.getElementById('pricing-modal');
      if (modal) {
        modal.style.display = 'flex';
        if (typeof updatePricingModalLang === 'function') updatePricingModalLang(currentLang);
      } else {
        window.location.href = '/pricing';
      }
    };
  }

  // Ücretler modalı çarpı ve arka plan kapatma
  const modal = document.getElementById('pricing-modal');
  const modalClose = document.getElementById('pricing-modal-close');
  if (modal && modalClose) {
    modalClose.onclick = function() {
      modal.style.display = 'none';
    };
    modal.onclick = function(e) {
      if (e.target === modal) modal.style.display = 'none';
    };
  }
}); 