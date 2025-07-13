const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

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
    const allowedPaths = [
      '/home',
      '/var/www',
      '/tmp',
      '/usr/local',
      '/root',
      process.cwd()
    ];
    
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
    const fileList = files.map(file => {
      const filePath = path.join(fullPath, file);
      const fileStats = fs.statSync(filePath);
      return {
        name: file,
        type: fileStats.isDirectory() ? 'folder' : 'file',
        path: path.join(requestedPath, file).replace(/\\/g, '/'),
        size: fileStats.isFile() ? fileStats.size : null,
        modified: fileStats.mtime
      };
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
    const allowedPaths = [
      '/home',
      '/var/www',
      '/tmp',
      '/usr/local',
      '/root',
      process.cwd()
    ];
    
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
    const allowedPaths = [
      '/home',
      '/var/www',
      '/tmp',
      '/usr/local',
      '/root',
      process.cwd()
    ];
    
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

// React uygulaması için catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
  console.log(`API: http://localhost:${PORT}/api`);
}); 