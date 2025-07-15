// Tüm kodu DOMContentLoaded ile sarmala
window.addEventListener('DOMContentLoaded', function() {
  console.log('app.js yüklendi! (DOMContentLoaded)');

  // Tema geçişi
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
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
  window.explorerBackBtn = null;
  window.explorerPathSpan = null;
  window.explorerSearch = null;
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
    en: {
      save: 'Save',
      dark: 'Dark',
      light: 'Light',
      explorer: 'EXPLORER',
      source: 'SOURCE CONTROL',
      run: 'RUN & DEBUG',
      extensions: 'EXTENSIONS',
      uploadDir: 'Upload Directory',
      githubOpen: 'Open from GitHub',
      searchPlaceholder: 'Search in this folder...',
      back: 'Go Up',
      gitStatus: 'Git Status',
      runBtn: 'Run',
      runOnlyPy: 'Only a Python file can be run.',
      terminal: 'Terminal',
      terminalShow: 'Show Terminal',
      terminalRun: 'Run',
      aiAgent: 'AI Agent',
      aiAsk: 'Ask something...',
      saveStatus: 'Saved successfully',
      autoSaved: 'Auto-saved:',
      loading: 'Loading...',
      working: 'Working...'
    },
    tr: {
      save: 'Kaydet',
      dark: 'Koyu',
      light: 'Açık',
      explorer: 'EXPLORER',
      source: 'KAYNAK KONTROL',
      run: 'ÇALIŞTIR',
      extensions: 'EKLENTİLER',
      uploadDir: 'Dizin Yükle',
      githubOpen: 'GitHub’dan Aç',
      searchPlaceholder: 'Bu dizinde ara...',
      back: 'Üst dizine çık',
      gitStatus: 'Git Durumu',
      runBtn: 'Çalıştır',
      runOnlyPy: 'Sadece açık bir Python dosyası çalıştırılabilir.',
      terminal: 'Terminal',
      terminalShow: 'Terminali Göster',
      terminalRun: 'Çalıştır',
      aiAgent: 'AI Agent',
      aiAsk: 'Bir şey sor...',
      saveStatus: 'Başarıyla kaydedildi',
      autoSaved: 'Otomatik kaydedildi:',
      loading: 'Yükleniyor...',
      working: 'Çalışıyor...'
    },
    de: {
      save: 'Speichern',
      dark: 'Dunkel',
      light: 'Hell',
      explorer: 'EXPLORER',
      source: 'QUELLENKONTROLLE',
      run: 'AUSFÜHREN',
      extensions: 'ERWEITERUNGEN',
      uploadDir: 'Verzeichnis hochladen',
      githubOpen: 'Von GitHub öffnen',
      searchPlaceholder: 'In diesem Ordner suchen...',
      back: 'Nach oben',
      gitStatus: 'Git Status',
      runBtn: 'Ausführen',
      runOnlyPy: 'Nur eine Python-Datei kann ausgeführt werden.',
      terminal: 'Terminal',
      terminalShow: 'Terminal anzeigen',
      terminalRun: 'Ausführen',
      aiAgent: 'KI-Agent',
      aiAsk: 'Etwas fragen...',
      saveStatus: 'Erfolgreich gespeichert',
      autoSaved: 'Automatisch gespeichert:',
      loading: 'Lädt...',
      working: 'Wird bearbeitet...'
    },
    fr: {
      save: 'Enregistrer',
      dark: 'Sombre',
      light: 'Clair',
      explorer: 'EXPLORER',
      source: 'CONTRÔLE DE SOURCE',
      run: 'EXÉCUTER',
      extensions: 'EXTENSIONS',
      uploadDir: 'Télécharger le dossier',
      githubOpen: 'Ouvrir depuis GitHub',
      searchPlaceholder: 'Rechercher dans ce dossier...',
      back: 'Monter',
      gitStatus: 'Statut Git',
      runBtn: 'Exécuter',
      runOnlyPy: 'Seul un fichier Python peut être exécuté.',
      terminal: 'Terminal',
      terminalShow: 'Afficher le terminal',
      terminalRun: 'Exécuter',
      aiAgent: 'Agent IA',
      aiAsk: 'Demander quelque chose...',
      saveStatus: 'Enregistré avec succès',
      autoSaved: 'Enregistré automatiquement:',
      loading: 'Chargement...',
      working: 'En cours...'
    },
    es: {
      save: 'Guardar',
      dark: 'Oscuro',
      light: 'Claro',
      explorer: 'EXPLORER',
      source: 'CONTROL DE FUENTES',
      run: 'EJECUTAR',
      extensions: 'EXTENSIONES',
      uploadDir: 'Subir directorio',
      githubOpen: 'Abrir desde GitHub',
      searchPlaceholder: 'Buscar en esta carpeta...',
      back: 'Subir',
      gitStatus: 'Estado de Git',
      runBtn: 'Ejecutar',
      runOnlyPy: 'Solo se puede ejecutar un archivo Python.',
      terminal: 'Terminal',
      terminalShow: 'Mostrar terminal',
      terminalRun: 'Ejecutar',
      aiAgent: 'Agente IA',
      aiAsk: 'Pregunta algo...',
      saveStatus: 'Guardado con éxito',
      autoSaved: 'Guardado automáticamente:',
      loading: 'Cargando...',
      working: 'Trabajando...'
    },
    hi: {
      save: 'सहेजें',
      dark: 'डार्क',
      light: 'लाइट',
      explorer: 'EXPLORER',
      source: 'स्रोत नियंत्रण',
      run: 'चलाएँ',
      extensions: 'एक्सटेंशन',
      uploadDir: 'डायरेक्टरी अपलोड करें',
      githubOpen: 'GitHub से खोलें',
      searchPlaceholder: 'इस फ़ोल्डर में खोजें...',
      back: 'ऊपर जाएं',
      gitStatus: 'Git स्थिति',
      runBtn: 'चलाएँ',
      runOnlyPy: 'केवल एक Python फ़ाइल चलाई जा सकती है।',
      terminal: 'टर्मिनल',
      terminalShow: 'टर्मिनल दिखाएँ',
      terminalRun: 'चलाएँ',
      aiAgent: 'एआई एजेंट',
      aiAsk: 'कुछ पूछें...',
      saveStatus: 'सफलतापूर्वक सहेजा गया',
      autoSaved: 'स्वचालित रूप से सहेजा गया:',
      loading: 'लोड हो रहा है...',
      working: 'काम कर रहा है...'
    },
    zh: {
      save: '保存',
      dark: '深色',
      light: '浅色',
      explorer: 'EXPLORER',
      source: '源代码管理',
      run: '运行',
      extensions: '扩展',
      uploadDir: '上传目录',
      githubOpen: '从GitHub打开',
      searchPlaceholder: '在此文件夹中搜索...',
      back: '上一级',
      gitStatus: 'Git状态',
      runBtn: '运行',
      runOnlyPy: '只能运行一个Python文件。',
      terminal: '终端',
      terminalShow: '显示终端',
      terminalRun: '运行',
      aiAgent: 'AI助手',
      aiAsk: '问点什么...',
      saveStatus: '保存成功',
      autoSaved: '自动保存:',
      loading: '加载中...',
      working: '工作中...'
    }
  };

  function setLanguage(lang) {
    localStorage.setItem('lang', lang);
    const t = translations[lang] || translations['en'];
    // Header
    if (saveBtn) saveBtn.innerHTML = `<i class="fa-regular fa-floppy-disk"></i> ${t.save}`;
    if (themeToggle) {
      const themeToggleIcon = document.getElementById('theme-toggle-icon');
      if (themeToggleIcon) themeToggleIcon.textContent = lang === 'dark' ? '☀️' : '🌙';
      themeToggle.innerHTML = `<span id="theme-toggle-icon">${lang === 'dark' ? '☀️' : '🌙'}</span> ${t.dark}`;
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
    attachActivityBtnHandlers();
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

}); 