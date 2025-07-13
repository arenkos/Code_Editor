const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Terminal oturumları için basit bir store
const terminalSessions = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// Production ortamında build klasörünü serve et
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
} else {
  app.use(express.static('build'));
}

// Dosya listesi endpoint'i
app.get('/api/files', (req, res) => {
  try {
    const requestedPath = req.query.path || '/';
    const fullPath = path.resolve(requestedPath);
    
    // Güvenlik kontrolü - sadece belirli dizinlere erişim
    const allowedPaths = ["/"];
    
    const isAllowed = allowedPaths.some(allowedPath => 
      fullPath.startsWith(path.resolve(allowedPath))
    );
    
    if (!isAllowed) {
      return res.status(403).json({ 
        error: 'Bu dizine erişim izni yok',
        path: requestedPath 
      });
    }
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ 
        error: 'Dizin bulunamadı',
        path: requestedPath 
      });
    }
    
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ 
        error: 'Bu bir dizin değil',
        path: requestedPath 
      });
    }
    
    const files = fs.readdirSync(fullPath);
    const fileList = [];
    files.forEach(file => {
      try {
        const filePath = path.join(fullPath, file);
        const fileStats = fs.statSync(filePath);
        fileList.push({
          name: file,
          type: fileStats.isDirectory() ? 'folder' : 'file',
          path: path.join(requestedPath, file).replace(/\\/g, '/'),
          size: fileStats.isFile() ? fileStats.size : null,
          modified: fileStats.mtime
        });
      } catch (e) {
        // Hatalı dosya atlanır
      }
    });
    
    // Klasörleri önce, dosyaları sonra sırala
    fileList.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json({
      path: requestedPath,
      files: fileList
    });
    
  } catch (error) {
    console.error('Dosya listesi hatası:', error);
    res.status(500).json({ 
      error: 'Dosya listesi alınamadı',
      message: error.message 
    });
  }
});

// Dosya içeriği endpoint'i
app.get('/api/file-content', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Dosya yolu belirtilmedi' });
    }
    
    const fullPath = path.resolve(filePath);
    
    // Güvenlik kontrolü
    const allowedPaths = ["/"];
    
    const isAllowed = allowedPaths.some(allowedPath => 
      fullPath.startsWith(path.resolve(allowedPath))
    );
    
    if (!isAllowed) {
      return res.status(403).json({ 
        error: 'Bu dosyaya erişim izni yok',
        path: filePath 
      });
    }
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ 
        error: 'Dosya bulunamadı',
        path: filePath 
      });
    }
    
    const stats = fs.statSync(fullPath);
    if (!stats.isFile()) {
      return res.status(400).json({ 
        error: 'Bu bir dosya değil',
        path: filePath 
      });
    }
    
    // Dosya boyutu kontrolü (10MB limit)
    if (stats.size > 10 * 1024 * 1024) {
      return res.status(413).json({ 
        error: 'Dosya çok büyük (10MB limit)',
        path: filePath 
      });
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({
      path: filePath,
      content: content,
      size: stats.size,
      modified: stats.mtime
    });
    
  } catch (error) {
    console.error('Dosya okuma hatası:', error);
    res.status(500).json({ 
      error: 'Dosya okunamadı',
      message: error.message 
    });
  }
});

// Dosya kaydetme endpoint'i
app.post('/api/save-file', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'Dosya yolu ve içerik gerekli' });
    }
    
    const fullPath = path.resolve(filePath);
    
    // Güvenlik kontrolü
    const allowedPaths = ["/"];
    
    const isAllowed = allowedPaths.some(allowedPath => 
      fullPath.startsWith(path.resolve(allowedPath))
    );
    
    if (!isAllowed) {
      return res.status(403).json({ 
        error: 'Bu dosyaya yazma izni yok',
        path: filePath 
      });
    }
    
    // Dizin kontrolü
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
    
    res.json({
      success: true,
      path: filePath,
      message: 'Dosya başarıyla kaydedildi'
    });
    
  } catch (error) {
    console.error('Dosya kaydetme hatası:', error);
    res.status(500).json({ 
      error: 'Dosya kaydedilemedi',
      message: error.message 
    });
  }
});

// Terminal komutları endpoint'i
app.post('/api/terminal', (req, res) => {
  try {
    const { command, sessionId = 'default' } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Komut belirtilmedi' });
    }
    
    // Güvenlik kontrolü - tehlikeli komutları engelle
    const dangerousCommands = [
      'rm -rf', 'dd', 'mkfs', 'fdisk', 'shutdown', 'reboot', 'halt',
      'init', 'killall', 'pkill', 'kill -9', 'sudo', 'su', 'passwd'
    ];
    
    const isDangerous = dangerousCommands.some(dangerous => 
      command.toLowerCase().includes(dangerous.toLowerCase())
    );
    
    if (isDangerous) {
      return res.status(403).json({ 
        error: 'Bu komut güvenlik nedeniyle engellendi',
        command: command 
      });
    }
    
    // Oturum kontrolü - yoksa oluştur
    if (!terminalSessions.has(sessionId)) {
      terminalSessions.set(sessionId, {
        cwd: '/var/www/code-editor',
        history: []
      });
    }
    
    const session = terminalSessions.get(sessionId);
    
    // Komutu çalıştır
    const { exec } = require('child_process');
    exec(command, { cwd: session.cwd, shell: "/bin/sh" }, (error, stdout, stderr) => {
      if (error) {
        res.json({
          success: false,
          output: stderr || error.message,
          error: true,
          cwd: session.cwd
        });
      } else {
        // cd komutu için çalışma dizinini güncelle
        if (command.trim().startsWith('cd ')) {
          const newPath = command.trim().substring(3).trim();
          if (newPath === '..') {
            session.cwd = path.dirname(session.cwd);
          } else if (newPath.startsWith('/')) {
            session.cwd = newPath;
          } else {
            session.cwd = path.resolve(session.cwd, newPath);
          }
        }
        
        // Komut geçmişine ekle
        session.history.push(command);
        if (session.history.length > 100) {
          session.history.shift();
        }
        
        res.json({
          success: true,
          output: stdout,
          error: false,
          cwd: session.cwd
        });
      }
    });
    
  } catch (error) {
    console.error('Terminal komut hatası:', error);
    res.status(500).json({ 
      error: 'Komut çalıştırılamadı',
      message: error.message 
    });
  }
});

// Terminal oturumu sıfırlama endpoint'i
app.post('/api/terminal/reset', (req, res) => {
  try {
    const { sessionId = 'default' } = req.body;
    
    terminalSessions.delete(sessionId);
    
    res.json({
      success: true,
      message: 'Terminal oturumu sıfırlandı'
    });
    
  } catch (error) {
    console.error('Terminal sıfırlama hatası:', error);
    res.status(500).json({ 
      error: 'Oturum sıfırlanamadı',
      message: error.message 
    });
  }
});

// React uygulaması için catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
  console.log(`API: http://localhost:${PORT}/api`);
}); 