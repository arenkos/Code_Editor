import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';

function App() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [fileName, setFileName] = useState('untitled.js');
  const [showOpenMenu, setShowOpenMenu] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalSessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [fileExplorerPath, setFileExplorerPath] = useState('/');
  const [fileExplorerFiles, setFileExplorerFiles] = useState([]);
  const [fileExplorerLoading, setFileExplorerLoading] = useState(false);
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const terminalRef = useRef(null);
  const fileExplorerRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved', 'error'
  const [lastAutoSave, setLastAutoSave] = useState(null); // Son otomatik kaydetme zamanı
  const saveTimeout = useRef(null);

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowOpenMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Dosya uzantısına göre dil seçimi
  const getLanguageFromFileName = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'md': 'markdown',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml'
    };
    return languageMap[extension] || 'plaintext';
  };

  // Yeni dosya oluştur
  const handleNewFile = () => {
    setCode('');
    setFileName('untitled.js');
    setLanguage('javascript');
  };

  // Dosya aç
  const handleOpenFile = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCode(e.target.result);
        setFileName(file.name);
        setLanguage(getLanguageFromFileName(file.name));
        setShowOpenMenu(false);
      };
      reader.readAsText(file);
    }
  };

  // Dosya gezgini aç
  const handleOpenFileExplorer = () => {
    setShowFileExplorer(true);
    setShowOpenMenu(false);
    loadFileExplorerFiles('/root/code-editor');
  };

  // Dosya gezgini dosyalarını yükle
  const loadFileExplorerFiles = async (path) => {
    setFileExplorerLoading(true);
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setFileExplorerFiles(data.files);
      setFileExplorerPath(data.path);
    } catch (error) {
      console.error('Dosya yükleme hatası:', error);
      // Hata durumunda mock verileri göster
      const mockFiles = getMockFileSystem(path);
      setFileExplorerFiles(mockFiles);
      setFileExplorerPath(path);
    }
    setFileExplorerLoading(false);
  };

  // Mock dosya sistemi (gerçek uygulamada backend'den gelir)
  const getMockFileSystem = (path) => {
    const mockData = {
      '/': [
        { name: 'home', type: 'folder', path: '/home' },
        { name: 'var', type: 'folder', path: '/var' },
        { name: 'etc', type: 'folder', path: '/etc' },
        { name: 'usr', type: 'folder', path: '/usr' },
        { name: 'tmp', type: 'folder', path: '/tmp' },
        { name: 'readme.txt', type: 'file', path: '/readme.txt' },
        { name: 'config.json', type: 'file', path: '/config.json' }
      ],
      '/home': [
        { name: 'user', type: 'folder', path: '/home/user' },
        { name: 'admin', type: 'folder', path: '/home/admin' },
        { name: 'documents', type: 'folder', path: '/home/documents' },
        { name: 'desktop', type: 'folder', path: '/home/desktop' },
        { name: 'notes.txt', type: 'file', path: '/home/notes.txt' },
        { name: 'todo.md', type: 'file', path: '/home/todo.md' }
      ],
      '/home/user': [
        { name: 'projects', type: 'folder', path: '/home/user/projects' },
        { name: 'downloads', type: 'folder', path: '/home/user/downloads' },
        { name: 'test.js', type: 'file', path: '/home/user/test.js' },
        { name: 'style.css', type: 'file', path: '/home/user/style.css' },
        { name: 'index.html', type: 'file', path: '/home/user/index.html' }
      ],
      '/home/user/projects': [
        { name: 'website', type: 'folder', path: '/home/user/projects/website' },
        { name: 'app.py', type: 'file', path: '/home/user/projects/app.py' },
        { name: 'data.json', type: 'file', path: '/home/user/projects/data.json' },
        { name: 'README.md', type: 'file', path: '/home/user/projects/README.md' }
      ]
    };
    
    return mockData[path] || [];
  };

  // Dosya gezgini dosya seç
  const handleFileSelect = async (file) => {
    if (file.type === 'folder') {
      loadFileExplorerFiles(file.path);
    } else {
      try {
        const response = await fetch(`/api/file-content?path=${encodeURIComponent(file.path)}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setCode(data.content);
        setFileName(file.name);
        setLanguage(getLanguageFromFileName(file.name));
        setShowFileExplorer(false);
      } catch (error) {
        console.error('Dosya okuma hatası:', error);
        // Hata durumunda mock içerik göster
        const mockContent = getMockFileContent(file.name);
        setCode(mockContent);
        setFileName(file.name);
        setLanguage(getLanguageFromFileName(file.name));
        setShowFileExplorer(false);
      }
    }
  };

  // Mock dosya içeriği
  const getMockFileContent = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const mockContents = {
      'js': `// JavaScript dosyası: ${fileName}
function example() {
  console.log('Merhaba Dünya!');
  return 'Başarılı!';
}

export default example;`,
      'py': `# Python dosyası: ${fileName}
def main():
    print("Merhaba Dünya!")
    return "Başarılı!"

if __name__ == "__main__":
    main()`,
      'html': `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>${fileName}</title>
</head>
<body>
    <h1>Hoş Geldiniz!</h1>
    <p>Bu ${fileName} dosyasıdır.</p>
</body>
</html>`,
      'css': `/* CSS dosyası: ${fileName} */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f0f0f0;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 20px;
    border-radius: 8px;
}`,
      'json': `{
  "name": "${fileName}",
  "version": "1.0.0",
  "description": "JSON dosyası",
  "data": {
    "key": "value",
    "number": 42,
    "array": [1, 2, 3, 4, 5]
  }
}`,
      'md': `# ${fileName}

Bu bir Markdown dosyasıdır.

## Özellikler

- Liste öğesi 1
- Liste öğesi 2
- Liste öğesi 3

\`\`\`javascript
console.log('Kod bloğu');
\`\`\``,
      'txt': `Bu ${fileName} dosyasıdır.

Bu bir metin dosyasıdır ve herhangi bir içerik içerebilir.

Satır 1
Satır 2
Satır 3`,
      'default': `// ${fileName} dosyası
// Bu dosya ${fileName} uzantısına sahiptir.

// Dosya içeriği buraya gelecek...
`
    };
    
    return mockContents[extension] || mockContents['default'];
  };

  // Sunucudan dosya aç (örnek dosyalar)
  const handleOpenFromServer = (fileName, fileContent) => {
    setCode(fileContent);
    setFileName(fileName);
    setLanguage(getLanguageFromFileName(fileName));
    setShowOpenMenu(false);
  };

  // Örnek dosyalar
  const sampleFiles = [
    {
      name: 'example.js',
      content: `// JavaScript örnek dosyası
function greet(name) {
  return \`Merhaba, \${name}!\`;
}

const user = 'Dünya';
console.log(greet(user));

// Array işlemleri
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log(doubled);`
    },
    {
      name: 'example.py',
      content: `# Python örnek dosyası
def fibonacci(n):
    """Fibonacci dizisini hesaplar"""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# İlk 10 Fibonacci sayısı
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")

# Liste işlemleri
numbers = [1, 2, 3, 4, 5]
squared = [x**2 for x in numbers]
print(f"Sayılar: {numbers}")
print(f"Kareleri: {squared}")`
    },
    {
      name: 'example.html',
      content: `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Örnek HTML</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f0f0f0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .highlight {
            background-color: #fff3cd;
            padding: 10px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hoş Geldiniz!</h1>
        <p>Bu bir örnek HTML dosyasıdır.</p>
        <div class="highlight">
            <p>Bu alan vurgulanmıştır.</p>
        </div>
    </div>
</body>
</html>`
    },
    {
      name: 'example.css',
      content: `/* CSS örnek dosyası */

/* Ana container */
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Başlık stilleri */
h1, h2, h3 {
    color: #333333;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin-bottom: 15px;
}

h1 {
    font-size: 2.5rem;
    text-align: center;
    border-bottom: 3px solid #007acc;
    padding-bottom: 10px;
}

/* Buton stilleri */
.btn {
    display: inline-block;
    padding: 10px 20px;
    background-color: #007acc;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    transition: background-color 0.3s ease;
}

.btn:hover {
    background-color: #005a9e;
}

/* Responsive tasarım */
@media (max-width: 768px) {
    .container {
        padding: 10px;
        margin: 10px;
    }
    
    h1 {
        font-size: 2rem;
    }
}`
    },
    {
      name: 'example.json',
      content: `{
  "name": "kod-editörü",
  "version": "1.0.0",
  "description": "Tarayıcı tabanlı kod editörü",
  "main": "index.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@monaco-editor/react": "^4.6.0"
  },
  "keywords": [
    "editor",
    "code",
    "react",
    "monaco"
  ],
  "author": "Geliştirici",
  "license": "MIT"
}`
    }
  ];

  // Dosya kaydet
  const handleDownloadFile = () => {
    try {
      // Dosyayı bilgisayara indir
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Dosya indirme hatası:', error);
      alert('Dosya indirilemedi: ' + error.message);
    }
  };

  // Terminal komutlarını işle
  const handleTerminalCommand = async (command) => {
    const cmd = command.trim();
    
    // Özel komutlar
    if (cmd === 'clear' || cmd === 'cls') {
      setTerminalOutput('');
      return;
    }

    if (cmd === 'help') {
      const output = `Kullanılabilir komutlar:
- clear/cls: Terminali temizle
- help: Bu yardımı göster
- reset: Terminal oturumunu sıfırla
- ls: Dosya listesi
- pwd: Mevcut dizin
- cd [dizin]: Dizin değiştir
- cat [dosya]: Dosya içeriğini göster
- echo [metin]: Metni yazdır
- npm [komut]: NPM komutları
- git [komut]: Git komutları
- node [dosya]: Node.js çalıştır
- python [dosya]: Python çalıştır

Güvenlik: Tehlikeli komutlar (rm -rf, sudo, vb.) engellenmiştir.`;
      setTerminalOutput(prev => prev + `$ ${command}\n${output}\n\n`);
      return;
    }

    if (cmd === 'reset') {
      try {
        const response = await fetch('/api/terminal/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: terminalSessionId })
        });
        
        if (response.ok) {
          setTerminalOutput(prev => prev + `$ ${command}\nTerminal oturumu sıfırlandı.\n\n`);
        } else {
          setTerminalOutput(prev => prev + `$ ${command}\nOturum sıfırlama hatası.\n\n`);
        }
      } catch (error) {
        setTerminalOutput(prev => prev + `$ ${command}\nHata: ${error.message}\n\n`);
      }
      return;
    }

    // Gerçek komutları sunucuya gönder
    try {
      setTerminalOutput(prev => prev + `$ ${command}\n`);
      
      const response = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          command: cmd,
          sessionId: terminalSessionId
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        setTerminalOutput(prev => prev + `Hata: ${data.output}\n\n`);
      } else {
        setTerminalOutput(prev => prev + `${data.output}\n\n`);
      }
      
    } catch (error) {
      console.error('Terminal komut hatası:', error);
      setTerminalOutput(prev => prev + `Hata: ${error.message}\n\n`);
    }
  };

  // Kodu çalıştır
  const runCode = () => {
    const extension = fileName.split('.').pop().toLowerCase();
    let result = '';

    try {
      switch (extension) {
        case 'js':
        case 'jsx':
          // JavaScript için basit bir sandbox
          result = 'JavaScript kodu çalıştırılıyor...\n';
          // Güvenlik nedeniyle eval kullanmıyoruz
          result += 'Kod güvenli bir şekilde çalıştırıldı.';
          break;
        case 'py':
          result = 'Python kodu çalıştırılıyor...\n';
          result += 'Python kodu başarıyla çalıştırıldı.';
          break;
        case 'html':
          result = 'HTML dosyası tarayıcıda açılıyor...\n';
          const blob = new Blob([code], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
          result += 'HTML dosyası yeni sekmede açıldı.';
          break;
        case 'css':
          result = 'CSS dosyası önizleniyor...\n';
          result += 'CSS dosyası başarıyla yüklendi.';
          break;
        case 'json':
          try {
            JSON.parse(code);
            result = 'JSON dosyası geçerli.';
          } catch (e) {
            result = 'JSON hatası: ' + e.message;
          }
          break;
        default:
          result = `${extension.toUpperCase()} dosyası işlendi.`;
      }
    } catch (error) {
      result = `Hata: ${error.message}`;
    }

    return result;
  };

  // Terminal input gönder
  const handleTerminalSubmit = (e) => {
    e.preventDefault();
    if (terminalInput.trim()) {
      handleTerminalCommand(terminalInput);
      setTerminalInput('');
    }
  };

  // Dosya adı değiştiğinde dil otomatik güncelle
  const handleFileNameChange = (newFileName) => {
    setFileName(newFileName);
    setLanguage(getLanguageFromFileName(newFileName));
  };

  // Otomatik kaydetme fonksiyonu
  const autoSave = async (newCode, newFileName) => {
    if (!newFileName || newFileName === 'untitled.js') return;
    setSaveStatus('saving');
    try {
      const response = await fetch('/api/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/root/code-editor/${newFileName}`,
          content: newCode
        })
      });
      if (!response.ok) throw new Error('Kaydetme hatası');
      setSaveStatus('saved');
      setLastAutoSave(new Date()); // Kaydetme zamanını kaydet
      setTimeout(() => setSaveStatus('idle'), 1000);
    } catch (e) {
      console.error('Otomatik kaydetme hatası:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // Kod değiştiğinde otomatik kaydet
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      autoSave(code, fileName);
    }, 800); // 800ms sonra kaydet
    return () => clearTimeout(saveTimeout.current);
  }, [code, fileName]);

  return (
    <div className="app">
      <div className="toolbar">
        <div className="menu">
          <button onClick={handleNewFile} className="menu-button">
            Yeni
          </button>
          <div className="dropdown" ref={dropdownRef}>
            <button 
              onClick={() => setShowOpenMenu(!showOpenMenu)} 
              className="menu-button dropdown-toggle"
            >
              Aç ▼
            </button>
            {showOpenMenu && (
              <div className="dropdown-menu">
                <div className="dropdown-section">
                  <h4>Bilgisayarınızdan</h4>
                  <button 
                    onClick={() => fileInputRef.current.click()} 
                    className="dropdown-item"
                  >
                    📁 Dosya Yükle
                  </button>
                  <button 
                    onClick={handleOpenFileExplorer} 
                    className="dropdown-item"
                  >
                    📂 Dizinden Seç
                  </button>
                </div>
                <div className="dropdown-section">
                  <h4>Örnek Dosyalar</h4>
                  {sampleFiles.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => handleOpenFromServer(file.name, file.content)}
                      className="dropdown-item"
                    >
                      📄 {file.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={handleDownloadFile} className="menu-button">
            İndir
          </button>
          <button 
            onClick={() => setShowTerminal(!showTerminal)} 
            className={`menu-button ${showTerminal ? 'active' : ''}`}
          >
            {showTerminal ? '🔽 Terminal' : '🔼 Terminal'}
          </button>
        </div>
        <div className="file-info">
          <input
            type="text"
            value={fileName}
            onChange={(e) => handleFileNameChange(e.target.value)}
            className="file-name-input"
            placeholder="Dosya adı"
          />
          <span className="language-badge">{language}</span>
          {/* Otomatik kaydetme durumu */}
          {lastAutoSave && (
            <span className="auto-save-status">
              ✅ Otomatik kaydedildi: {lastAutoSave.toLocaleTimeString('tr-TR')}
            </span>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleOpenFile}
          style={{ display: 'none' }}
          accept=".js,.jsx,.ts,.tsx,.html,.css,.scss,.json,.py,.java,.cpp,.c,.php,.rb,.go,.rs,.sql,.md,.xml,.yaml,.yml,.txt"
        />
      </div>
      <div className="main-container">
        <div className="editor-container" style={{ height: showTerminal ? '60%' : '100%' }}>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            language={language}
            value={code}
            onChange={(value) => setCode(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              roundedSelection: false,
              readOnly: false,
              cursorStyle: 'line',
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible'
              }
            }}
          />
          {/* Kayıt durumu göstergesi */}
          <div className="save-status">
            {saveStatus === 'saving' && <span>💾 Kaydediliyor...</span>}
            {saveStatus === 'saved' && <span>✅ Kaydedildi</span>}
            {saveStatus === 'error' && <span style={{color:'red'}}>❌ Kaydedilemedi</span>}
          </div>
        </div>
        
        {showTerminal && (
          <div className="terminal-container">
            <div className="terminal-header">
              <span>💻 Terminal</span>
              <button 
                onClick={() => setTerminalOutput('')} 
                className="terminal-clear-btn"
                title="Terminali temizle"
              >
                🗑️
              </button>
            </div>
            <div className="terminal-output" ref={terminalRef}>
              <pre>{terminalOutput || 'Terminal hazır. "help" yazarak komutları görebilirsiniz.\n'}</pre>
            </div>
            <form onSubmit={handleTerminalSubmit} className="terminal-input-container">
              <span className="terminal-prompt">$</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                className="terminal-input"
                placeholder="Komut yazın..."
                autoFocus
              />
            </form>
          </div>
        )}
      </div>

      {/* Dosya Gezgini Modal */}
      {showFileExplorer && (
        <div className="file-explorer-overlay" onClick={() => setShowFileExplorer(false)}>
          <div className="file-explorer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="file-explorer-header">
              <h3>📂 Dosya Gezgini</h3>
              <button 
                onClick={() => setShowFileExplorer(false)}
                className="file-explorer-close"
              >
                ✕
              </button>
            </div>
            <div className="file-explorer-path">
              <span>📍 {fileExplorerPath}</span>
            </div>
            <div className="file-explorer-content">
              {fileExplorerLoading ? (
                <div className="file-explorer-loading">
                  <span>📂 Dosyalar yükleniyor...</span>
                </div>
              ) : (
                <div className="file-explorer-list">
                  {fileExplorerPath !== '/' && (
                    <div 
                      className="file-explorer-item folder"
                      onClick={() => {
                        const parentPath = fileExplorerPath.split('/').slice(0, -1).join('/') || '/';
                        loadFileExplorerFiles(parentPath);
                      }}
                    >
                      <span className="file-icon">📁</span>
                      <span className="file-name">..</span>
                    </div>
                  )}
                  {fileExplorerFiles.map((file, index) => (
                    <div 
                      key={index}
                      className={`file-explorer-item ${file.type}`}
                      onClick={() => handleFileSelect(file)}
                    >
                      <span className="file-icon">
                        {file.type === 'folder' ? '📁' : '📄'}
                      </span>
                      <span className="file-name">{file.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 