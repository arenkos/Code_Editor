# OAuth Kurulum Rehberi

Bu dosya, Google ve GitHub OAuth entegrasyonu için gerekli adımları açıklar.

## ⚠️ Önemli Not

OAuth butonları şu anda çalışmıyor çünkü environment variables ayarlanmamış. Bu rehberi takip ederek OAuth'u aktif hale getirebilirsiniz.

## Gerekli Environment Variables

Aşağıdaki environment variables'ları `.env` dosyasında veya sistem ortamında tanımlayın:

```bash
# Flask Secret Key (güvenlik için - MUTLAKA DEĞİŞTİRİN!)
SECRET_KEY=your-secret-key-change-this

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth  
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## Google OAuth Kurulumu

### 1. Google Cloud Console'da Proje Oluşturma
1. [Google Cloud Console](https://console.cloud.google.com/)'a gidin
2. Yeni bir proje oluşturun veya mevcut projeyi seçin
3. Proje adı: "AR Code Editor" (veya istediğiniz isim)

### 2. OAuth 2.0 Client ID Oluşturma
1. Sol menüden "APIs & Services" > "Credentials" bölümüne gidin
2. "Create Credentials" > "OAuth 2.0 Client IDs" seçin
3. Application type: "Web application" seçin
4. Name: "AR Code Editor OAuth"
5. **Authorized redirect URIs** bölümüne şunu ekleyin:
   - `http://localhost:3001/auth/google/callback` (geliştirme için)
   - `https://code.aryazilimdanismanlik.com/auth/google/callback` (production için)
6. "Create" tıklayın
7. **Client ID** ve **Client Secret**'ı kopyalayın

### 3. Google+ API'yi Etkinleştirme
1. "APIs & Services" > "Library" bölümüne gidin
2. "Google+ API" aratın ve etkinleştirin
3. "OAuth consent screen" bölümünde gerekli izinleri ekleyin

## GitHub OAuth Kurulumu

### 1. GitHub Developer Settings
1. [GitHub Developer Settings](https://github.com/settings/developers)'e gidin
2. "OAuth Apps" > "New OAuth App" tıklayın

### 2. OAuth App Oluşturma
1. **Application name**: "AR Code Editor"
2. **Homepage URL**: 
   - Geliştirme: `http://localhost:3001`
   - Production: `https://code.aryazilimdanismanlik.com`
3. **Authorization callback URL**: 
   - Geliştirme: `http://localhost:3001/auth/github/callback`
   - Production: `https://code.aryazilimdanismanlik.com/auth/github/callback`
4. "Register application" tıklayın
5. **Client ID** ve **Client Secret**'ı kopyalayın

## Kurulum Adımları

### 1. Paketleri Yükleyin
```bash
pip install -r requirements.txt
```

### 2. Environment Variables Ayarlayın

#### Linux/Mac için:
```bash
export SECRET_KEY="your-secret-key-here"
export GOOGLE_CLIENT_ID="your-google-client-id"
export GOOGLE_CLIENT_SECRET="your-google-client-secret"
export GITHUB_CLIENT_ID="your-github-client-id"
export GITHUB_CLIENT_SECRET="your-github-client-secret"
```

#### Windows için:
```cmd
set SECRET_KEY=your-secret-key-here
set GOOGLE_CLIENT_ID=your-google-client-id
set GOOGLE_CLIENT_SECRET=your-google-client-secret
set GITHUB_CLIENT_ID=your-github-client-id
set GITHUB_CLIENT_SECRET=your-github-client-secret
```

#### .env dosyası oluşturun:
```bash
# .env dosyası oluşturun
echo "SECRET_KEY=your-secret-key-here" > .env
echo "GOOGLE_CLIENT_ID=your-google-client-id" >> .env
echo "GOOGLE_CLIENT_SECRET=your-google-client-secret" >> .env
echo "GITHUB_CLIENT_ID=your-github-client-id" >> .env
echo "GITHUB_CLIENT_SECRET=your-github-client-secret" >> .env
```

### 3. Uygulamayı Çalıştırın
```bash
python app.py
```

### 4. OAuth Durumunu Kontrol Edin
Tarayıcıda şu adresi açın: `http://localhost:3001/api/oauth-status`

Beklenen yanıt:
```json
{
  "google_enabled": true,
  "github_enabled": true,
  "secret_key_set": true
}
```

## Test

1. Uygulamayı açın: `http://localhost:3001`
2. "Kayıt Ol-Giriş Yap" butonuna tıklayın
3. Google veya GitHub butonlarına tıklayın
4. OAuth akışını tamamlayın
5. Başarılı giriş sonrası kullanıcı adınızı görmelisiniz

## Sorun Giderme

### OAuth Butonları Gri Görünüyor
- Environment variables'ların doğru ayarlandığından emin olun
- `/api/oauth-status` endpoint'ini kontrol edin

### "Invalid redirect_uri" Hatası
- Google/GitHub OAuth app ayarlarında redirect URI'ların doğru olduğundan emin olun
- Domain adresinin tam olarak eşleştiğinden emin olun

### "Client ID not found" Hatası
- Client ID ve Client Secret'ın doğru kopyalandığından emin olun
- Environment variables'ların doğru ayarlandığından emin olun

## Production Notları

- HTTPS kullanın
- `OAUTHLIB_INSECURE_TRANSPORT`'u kaldırın
- Secret key'i güvenli bir şekilde saklayın
- Callback URL'leri production domain'inize göre güncelleyin
- Rate limiting ve güvenlik önlemlerini alın

## Güvenlik

- `.env` dosyasını `.gitignore`'a ekleyin
- Secret key'i asla kod içinde saklamayın
- Production'da environment variables'ları güvenli bir şekilde yönetin
- OAuth app'lerinizin güvenlik ayarlarını kontrol edin 