# Python Code Editor Backend

Bu klasör, Express.js sunucusunun Python (Flask) ile yeniden yazılmış halini içerir.

## Kurulum

1. Gerekli paketleri yükleyin:

```
pip install -r requirements.txt
```

2. Sunucuyu başlatın:

```
python app.py
```

Sunucu varsayılan olarak 3001 portunda çalışır.

## API Endpointleri
- `/api/files` : Dosya/dizin listeleme
- `/api/file-content` : Dosya içeriği okuma
- `/api/save-file` : Dosya kaydetme
- `/api/terminal` : Terminal komutu çalıştırma
- `/api/terminal/reset` : Terminal oturumunu sıfırlama

React uygulamasının build çıktısı `../build` klasöründe olmalıdır. 