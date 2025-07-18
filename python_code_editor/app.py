from flask import Flask, request, jsonify, send_from_directory, render_template, after_this_request, session, redirect, url_for
from flask_cors import CORS
import os
import subprocess
import threading
from pathlib import Path
import tempfile
import shutil
import requests
import base64
import openai
import anthropic
import google.generativeai as genai
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
from flask_dance.contrib.google import make_google_blueprint, google
from flask_dance.contrib.github import make_github_blueprint, github
from functools import wraps

# Paket kontrolü için decorator
PACKAGE_MAP = {
    'ai_basic': ['ai_basic'],
    'ai_pro': ['ai_pro', 'ai_pro_server', 'ai_unlimited', 'ai_unlimited_server'],
    'ai_unlimited': ['ai_unlimited', 'ai_unlimited_server'],
    'server': ['server', 'ai_pro_server', 'ai_unlimited_server'],
    'ai_pro_server': ['ai_pro_server'],
    'ai_unlimited_server': ['ai_unlimited_server']
}

def require_package(*allowed_packages):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user_package = session.get('package', 'basic')
            # Kombin paketler için
            for allowed in allowed_packages:
                if user_package in PACKAGE_MAP.get(allowed, [allowed]):
                    return f(*args, **kwargs)
            return jsonify({'error': 'Bu hizmete erişim için uygun pakete sahip değilsiniz.'}), 403
        return wrapper
    return decorator

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Terminal oturumları için basit bir store
terminal_sessions = {}

# Ana dizin (güvenlik için sadece buraya erişim verilecek)
ALLOWED_PATHS = ["/"]

UPLOAD_ROOT = os.path.join(tempfile.gettempdir(), 'uploaded_dirs')
os.makedirs(UPLOAD_ROOT, exist_ok=True)

# Sistem API anahtarları (şimdilik .env veya os.environ üzerinden)
SYSTEM_KEYS = {
    "openai": os.environ.get("OPENAI_API_KEY"),
    "claude": os.environ.get("ANTHROPIC_API_KEY"),
    "gemini": os.environ.get("GOOGLE_API_KEY"),
    "copilot": os.environ.get("COPILOT_API_KEY"),
}

def get_api_key(service, user_key):
    return user_key if user_key else SYSTEM_KEYS.get(service)

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store'
    return response

@app.route('/api/files', methods=['GET'])
def list_files():
    try:
        requested_path = request.args.get('path', '/')
        full_path = os.path.abspath(requested_path)
        is_allowed = any(full_path.startswith(os.path.abspath(p)) for p in ALLOWED_PATHS)
        if not is_allowed:
            return jsonify({'error': 'Bu dizine erişim izni yok', 'path': requested_path}), 403
        if not os.path.exists(full_path):
            return jsonify({'error': 'Dizin bulunamadı', 'path': requested_path}), 404
        if not os.path.isdir(full_path):
            return jsonify({'error': 'Bu bir dizin değil', 'path': requested_path}), 400
        files = os.listdir(full_path)
        file_list = []
        for file in files:
            try:
                file_path = os.path.join(full_path, file)
                stat = os.stat(file_path)
                file_list.append({
                    'name': file,
                    'type': 'folder' if os.path.isdir(file_path) else 'file',
                    'path': os.path.join(requested_path, file).replace('\\', '/'),
                    'size': stat.st_size if os.path.isfile(file_path) else None,
                    'modified': stat.st_mtime
                })
            except Exception:
                pass
        file_list.sort(key=lambda x: (x['type'] != 'folder', x['name']))
        return jsonify({'path': requested_path, 'files': file_list})
    except Exception as e:
        return jsonify({'error': 'Dosya listesi alınamadı', 'message': str(e)}), 500

@app.route('/api/file-content', methods=['GET'])
def file_content():
    try:
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'error': 'Dosya yolu belirtilmedi'}), 400
        full_path = os.path.abspath(file_path)
        is_allowed = any(full_path.startswith(os.path.abspath(p)) for p in ALLOWED_PATHS)
        if not is_allowed:
            return jsonify({'error': 'Bu dosyaya erişim izni yok', 'path': file_path}), 403
        if not os.path.exists(full_path):
            return jsonify({'error': 'Dosya bulunamadı', 'path': file_path}), 404
        if not os.path.isfile(full_path):
            return jsonify({'error': 'Bu bir dosya değil', 'path': file_path}), 400
        size = os.path.getsize(full_path)
        if size > 10 * 1024 * 1024:
            return jsonify({'error': 'Dosya çok büyük (10MB limit)', 'path': file_path}), 413
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        modified = os.path.getmtime(full_path)
        return jsonify({'path': file_path, 'content': content, 'size': size, 'modified': modified})
    except Exception as e:
        return jsonify({'error': 'Dosya okunamadı', 'message': str(e)}), 500

@app.route('/api/save-file', methods=['POST'])
def save_file():
    try:
        data = request.get_json()
        file_path = data.get('path')
        content = data.get('content')
        if not file_path or content is None:
            return jsonify({'error': 'Dosya yolu ve içerik gerekli'}), 400
        full_path = os.path.abspath(file_path)
        is_allowed = any(full_path.startswith(os.path.abspath(p)) for p in ALLOWED_PATHS)
        if not is_allowed:
            return jsonify({'error': 'Bu dosyaya yazma izni yok', 'path': file_path}), 403
        dir_path = os.path.dirname(full_path)
        os.makedirs(dir_path, exist_ok=True)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({'success': True, 'path': file_path, 'message': 'Dosya başarıyla kaydedildi'})
    except Exception as e:
        return jsonify({'error': 'Dosya kaydedilemedi', 'message': str(e)}), 500

# Admin: Kullanıcıya paket atama
@app.route('/api/admin/set-package', methods=['POST'])
def admin_set_package():
    data = request.get_json()
    username = data.get('username')
    package = data.get('package')
    if not username or not package:
        return jsonify({'error': 'Kullanıcı adı ve paket gerekli'}), 400
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('UPDATE users SET package=? WHERE username=?', (package, username))
        conn.commit()
    return jsonify({'success': True, 'message': f'{username} kullanıcısının paketi {package} olarak güncellendi.'})

# AI Agent endpointinde paket kontrolü örneği
@app.route('/api/ai-agent', methods=['POST'])
@require_package('ai_basic', 'ai_pro', 'ai_unlimited', 'ai_pro_server', 'ai_unlimited_server')
def ai_agent():
    data = request.json
    message = data.get('message', '')
    file_path = data.get('file_path')
    service_model = data.get('service', 'openai:gpt-4')
    if ':' in service_model:
        service, model = service_model.split(':', 1)
    else:
        service, model = service_model, ''
    api_key = get_api_key(service, data.get('api_key'))
    edit_mode = data.get('edit_mode', 'confirm')

    # Dosya içeriği gerekiyorsa oku
    file_content = None
    if file_path:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                file_content = f.read()
        except Exception as e:
            return jsonify({'error': f'Dosya okunamadı: {str(e)}'}), 400

    # Prompt hazırla
    prompt = message
    if file_content:
        prompt += f"\n\nAşağıdaki dosya içeriğiyle ilgili işlem yap:\n{file_content}"

    # Yanıtı al
    try:
        if service == "openai":
            openai.api_key = api_key
            response = openai.ChatCompletion.create(
                model=model,
                messages=[
                    {"role": "system", "content": "Sen bir kod editörü asistanısın."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1024,
                temperature=0.2
            )
            ai_reply = response['choices'][0]['message']['content']

        elif service == "claude":
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model=model,
                max_tokens=1024,
                temperature=0.2,
                messages=[{"role": "user", "content": prompt}]
            )
            ai_reply = response.content[0].text

        elif service == "gemini":
            genai.configure(api_key=api_key)
            model_obj = genai.GenerativeModel(model)
            response = model_obj.generate_content(prompt)
            ai_reply = response.text

        elif service == "copilot":
            ai_reply = "Copilot API henüz desteklenmiyor. (Demo yanıt)"

        else:
            return jsonify({'error': 'Bilinmeyen AI servisi'}), 400

        # Dosya düzenleme
        if file_path and edit_mode == "auto":
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(ai_reply)
            except Exception as e:
                return jsonify({'error': f'Dosya yazılamadı: {str(e)}'}), 400

        return jsonify({'reply': ai_reply})

    except Exception as e:
        return jsonify({'error': f'AI API hatası: {str(e)}'}), 500

# Terminal endpointinde paket kontrolü örneği
@app.route('/api/terminal', methods=['POST'])
@require_package('server', 'ai_pro_server', 'ai_unlimited_server')
def terminal():
    try:
        data = request.get_json()
        command = data.get('command')
        session_id = data.get('sessionId', 'default')
        if not command:
            return jsonify({'error': 'Komut belirtilmedi'}), 400
        # Tehlikeli komutları engelle
        dangerous_commands = [
            'rm -rf', 'dd', 'mkfs', 'fdisk', 'shutdown', 'reboot', 'halt',
            'init', 'killall', 'pkill', 'kill -9', 'sudo', 'su', 'passwd'
        ]
        if any(d in command.lower() for d in dangerous_commands):
            return jsonify({'error': 'Bu komut güvenlik nedeniyle engellendi', 'command': command}), 403
        # Oturum kontrolü
        if session_id not in terminal_sessions:
            terminal_sessions[session_id] = {
                'cwd': os.getcwd(),  # Sunucunun başlatıldığı dizin
                'history': []
            }
        session = terminal_sessions[session_id]
        # Komutu çalıştır
        def run_command():
            try:
                result = subprocess.run(command, shell=True, cwd=session['cwd'], capture_output=True, text=True, executable='/bin/sh')
                output = result.stdout
                error = result.stderr
                # cd komutu için çalışma dizinini güncelle
                if command.strip().startswith('cd '):
                    new_path = command.strip()[3:].strip()
                    if new_path == '..':
                        session['cwd'] = str(Path(session['cwd']).parent)
                    elif new_path.startswith('/'):
                        session['cwd'] = new_path
                    else:
                        session['cwd'] = str(Path(session['cwd']) / new_path)
                # Komut geçmişine ekle
                session['history'].append(command)
                if len(session['history']) > 100:
                    session['history'].pop(0)
                if result.returncode != 0:
                    return jsonify({'success': False, 'output': error or 'Hata oluştu', 'error': True, 'cwd': session['cwd']})
                else:
                    return jsonify({'success': True, 'output': output, 'error': False, 'cwd': session['cwd']})
            except Exception as e:
                return jsonify({'success': False, 'output': str(e), 'error': True, 'cwd': session['cwd']})
        return run_command()
    except Exception as e:
        return jsonify({'error': 'Komut çalıştırılamadı', 'message': str(e)}), 500

@app.route('/api/terminal/reset', methods=['POST'])
def reset_terminal():
    try:
        data = request.get_json() or {}
        session_id = data.get('sessionId', 'default')
        terminal_sessions.pop(session_id, None)
        return jsonify({'success': True, 'message': 'Terminal oturumu sıfırlandı'})
    except Exception as e:
        return jsonify({'error': 'Oturum sıfırlanamadı', 'message': str(e)}), 500

@app.route('/api/upload-directory', methods=['POST'])
def upload_directory():
    try:
        files = request.files.getlist('files')
        session_id = request.form.get('sessionId', 'default')
        user_dir = os.path.join(UPLOAD_ROOT, session_id)
        if os.path.exists(user_dir):
            shutil.rmtree(user_dir)
        os.makedirs(user_dir, exist_ok=True)
        for f in files:
            rel_path = f.filename.lstrip('/')
            save_path = os.path.join(user_dir, rel_path)
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            f.save(save_path)
        return jsonify({'success': True, 'message': 'Dizin yüklendi', 'root': user_dir})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/github-list', methods=['POST'])
def github_list():
    try:
        data = request.json
        repo_url = data.get('repo_url')
        branch = data.get('branch')
        token = data.get('token')
        if not repo_url:
            return jsonify({'error': 'Repo URL gerekli'}), 400
        parts = repo_url.rstrip('/').split('/')
        user_repo = '/'.join(parts[-2:])
        headers = {}
        if token:
            headers['Authorization'] = f'token {token}'
        if not branch:
            repo_api_url = f'https://api.github.com/repos/{user_repo}'
            repo_resp = requests.get(repo_api_url, headers=headers)
            if repo_resp.status_code == 200:
                branch = repo_resp.json().get('default_branch', 'main')
            else:
                branch = 'main'
        api_url = f'https://api.github.com/repos/{user_repo}/git/trees/{branch}?recursive=1'
        resp = requests.get(api_url, headers=headers)
        if resp.status_code != 200:
            return jsonify({'error': f'GitHub API hatası: {resp.status_code}', 'details': resp.text}), 400
        tree = resp.json().get('tree', [])
        files = [item for item in tree if item['type'] == 'blob']
        return jsonify({'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/github-file', methods=['POST'])
def github_file():
    try:
        data = request.json
        repo_url = data.get('repo_url')
        branch = data.get('branch')
        path = data.get('path')
        token = data.get('token')
        if not repo_url or not path:
            return jsonify({'error': 'Repo URL ve dosya yolu gerekli'}), 400
        parts = repo_url.rstrip('/').split('/')
        user_repo = '/'.join(parts[-2:])
        headers = {}
        if token:
            headers['Authorization'] = f'token {token}'
        if not branch:
            repo_api_url = f'https://api.github.com/repos/{user_repo}'
            repo_resp = requests.get(repo_api_url, headers=headers)
            if repo_resp.status_code == 200:
                branch = repo_resp.json().get('default_branch', 'main')
            else:
                branch = 'main'
        api_url = f'https://api.github.com/repos/{user_repo}/contents/{path}?ref={branch}'
        resp = requests.get(api_url, headers=headers)
        if resp.status_code != 200:
            return jsonify({'error': 'GitHub API hatası', 'details': resp.text}), 400
        content = resp.json().get('content', '')
        if content:
            try:
                content = content.replace('\n', '')
                decoded = base64.b64decode(content).decode('utf-8')
            except Exception as e:
                return jsonify({'error': f'Decode hatası: {str(e)}'})
        else:
            decoded = ''
        return jsonify({'content': decoded})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/github-save', methods=['POST'])
def github_save():
    try:
        data = request.json
        repo_url = data.get('repo_url')
        branch = data.get('branch')
        path = data.get('path')
        content = data.get('content')
        commit_message = data.get('commit_message')
        token = data.get('token')
        if not repo_url or not path or not content or not commit_message or not token:
            return jsonify({'error': 'Tüm alanlar gerekli'}), 400
        parts = repo_url.rstrip('/').split('/')
        user_repo = '/'.join(parts[-2:])
        headers = {'Authorization': f'token {token}', 'Accept': 'application/vnd.github.v3+json'}
        # Branch yoksa default_branch çek
        if not branch:
            repo_api_url = f'https://api.github.com/repos/{user_repo}'
            repo_resp = requests.get(repo_api_url, headers=headers)
            if repo_resp.status_code == 200:
                branch = repo_resp.json().get('default_branch', 'main')
            else:
                branch = 'main'
        # Önce dosyanın sha'sını al
        file_api_url = f'https://api.github.com/repos/{user_repo}/contents/{path}?ref={branch}'
        file_resp = requests.get(file_api_url, headers=headers)
        if file_resp.status_code != 200:
            return jsonify({'error': 'Dosya SHA alınamadı', 'details': file_resp.text}), 400
        sha = file_resp.json().get('sha')
        if not sha:
            return jsonify({'error': 'Dosya SHA bulunamadı'}), 400
        # İçeriği base64 encode et
        encoded_content = base64.b64encode(content.encode('utf-8')).decode('utf-8')
        # Dosyayı güncelle (commit+push)
        update_data = {
            'message': commit_message,
            'content': encoded_content,
            'sha': sha,
            'branch': branch
        }
        update_resp = requests.put(file_api_url, headers=headers, json=update_data)
        if update_resp.status_code not in (200, 201):
            return jsonify({'error': 'Push başarısız', 'details': update_resp.text}), 400
        return jsonify({'success': True, 'message': 'Push başarılı'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Kullanıcı veritabanı (SQLite)
DB_PATH = os.path.join(os.path.dirname(__file__), 'users.db')

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            fullname TEXT,
            birthdate TEXT,
            password TEXT NOT NULL,
            package TEXT DEFAULT 'basic'
        )''')
        conn.commit()
init_db()

# Kullanıcı kaydı
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    fullname = data.get('fullname')
    birthdate = data.get('birthdate')
    password = data.get('password')
    password_confirm = data.get('password_confirm')
    package = data.get('package', 'basic')
    
    if not username or not email or not password:
        return jsonify({'error': 'Kullanıcı adı, e-posta ve şifre gerekli'}), 400
    
    if password != password_confirm:
        return jsonify({'error': 'Şifreler eşleşmiyor'}), 400
    
    hashed_pw = generate_password_hash(password)
    try:
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute('INSERT INTO users (username, email, fullname, birthdate, password, package) VALUES (?, ?, ?, ?, ?, ?)', 
                     (username, email, fullname, birthdate, hashed_pw, package))
            conn.commit()
        return jsonify({'success': True, 'message': 'Kayıt başarılı'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Kullanıcı adı veya e-posta zaten kayıtlı'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Kullanıcı girişi
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Kullanıcı adı ve şifre gerekli'}), 400
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('SELECT id, password, package FROM users WHERE username=? OR email=?', (username, username))
        row = c.fetchone()
        if not row:
            return jsonify({'error': 'Kullanıcı bulunamadı'}), 400
        user_id, hashed_pw, package = row
        if not check_password_hash(hashed_pw, password):
            return jsonify({'error': 'Şifre yanlış'}), 400
        session['user_id'] = user_id
        session['username'] = username
        session['package'] = package
        return jsonify({'success': True, 'message': 'Giriş başarılı', 'package': package})

# Çıkış
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Çıkış yapıldı'})

# Giriş kontrolü (örnek korumalı endpoint)
@app.route('/api/user', methods=['GET'])
def get_user():
    if 'user_id' not in session:
        return jsonify({'logged_in': False})
    return jsonify({'logged_in': True, 'username': session.get('username')})

# OAuth durumu kontrolü
@app.route('/api/oauth-status', methods=['GET'])
def oauth_status():
    google_enabled = bool(os.environ.get('GOOGLE_CLIENT_ID') and os.environ.get('GOOGLE_CLIENT_SECRET'))
    github_enabled = bool(os.environ.get('GITHUB_CLIENT_ID') and os.environ.get('GITHUB_CLIENT_SECRET'))
    return jsonify({
        'google_enabled': google_enabled,
        'github_enabled': github_enabled,
        'secret_key_set': bool(os.environ.get('SECRET_KEY'))
    })

# --- OAUTH (Google, GitHub) ---
# OAuth için gerekli ayarlar
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-change-this')
# Production'da HTTPS kullanıldığı için güvenli transport'u etkinleştir
app.config['OAUTHLIB_INSECURE_TRANSPORT'] = False  # HTTPS kullanıyoruz

# OAuth blueprint'lerini sadece environment variables varsa oluştur
google_client_id = os.environ.get('GOOGLE_CLIENT_ID')
google_client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
github_client_id = os.environ.get('GITHUB_CLIENT_ID')
github_client_secret = os.environ.get('GITHUB_CLIENT_SECRET')

if google_client_id and google_client_secret:
    # Google OAuth Blueprint
    google_bp = make_google_blueprint(
        client_id=google_client_id,
        client_secret=google_client_secret,
        scope=["profile", "email"],
        redirect_url="https://code.aryazilimdanismanlik.com/auth/google/google/authorized"
    )
    app.register_blueprint(google_bp, url_prefix="/auth/google")
    print("Google OAuth blueprint kayıtlı")

if github_client_id and github_client_secret:
    # GitHub OAuth Blueprint  
    github_bp = make_github_blueprint(
        client_id=github_client_id,
        client_secret=github_client_secret,
        scope="user:email",
        redirect_url="https://code.aryazilimdanismanlik.com/auth/github/github/authorized"
    )
    app.register_blueprint(github_bp, url_prefix="/auth/github")
    print("GitHub OAuth blueprint kayıtlı")

# Google OAuth callback
@app.route('/auth/google/google/authorized')
def google_auth_callback():
    try:
        if not google.authorized:
            return redirect(url_for('google.login'))
        resp = google.get('/oauth2/v2/userinfo')
        if not resp.ok:
            return redirect('/')
        info = resp.json()
        email = info.get('email')
        username = info.get('name') or email.split('@')[0]
        # Kullanıcıyı veritabanında bul veya oluştur
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute('SELECT id FROM users WHERE email=?', (email,))
            row = c.fetchone()
            if not row:
                c.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', (username, email, generate_password_hash('oauth')))
                conn.commit()
                user_id = c.lastrowid
            else:
                user_id = row[0]
        session['user_id'] = user_id
        session['username'] = username
        return redirect('/')
    except Exception as e:
        print(f"Google OAuth hatası: {e}")
        return redirect('/')

# GitHub OAuth callback
@app.route('/auth/github/github/authorized')
def github_auth_callback():
    try:
        if not github.authorized:
            return redirect(url_for('github.login'))
        resp = github.get('/user')
        if not resp.ok:
            return redirect('/')
        info = resp.json()
        username = info.get('login')
        # E-posta almak için ayrı istek
        email = None
        emails_resp = github.get('/user/emails')
        if emails_resp.ok:
            emails = emails_resp.json()
            for e in emails:
                if e.get('primary'):
                    email = e.get('email')
                    break
        if not email:
            email = username + '@github.com'
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute('SELECT id FROM users WHERE email=?', (email,))
            row = c.fetchone()
            if not row:
                c.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', (username, email, generate_password_hash('oauth')))
                conn.commit()
                user_id = c.lastrowid
            else:
                user_id = row[0]
        session['user_id'] = user_id
        session['username'] = username
        return redirect('/')
    except Exception as e:
        print(f"GitHub OAuth hatası: {e}")
        return redirect('/')

# OAuth Login Endpoints
@app.route('/auth/google')
def google_login():
    if not google_client_id or not google_client_secret:
        return jsonify({'error': 'Google OAuth yapılandırılmamış'}), 400
    try:
        # HTTPS kullanarak OAuth akışını başlat
        return redirect(url_for('google.login', _scheme='https', _external=True))
    except Exception as e:
        print(f"Google OAuth login hatası: {e}")
        return jsonify({'error': 'Google OAuth hatası'}), 500

@app.route('/auth/github')
def github_login():
    if not github_client_id or not github_client_secret:
        return jsonify({'error': 'GitHub OAuth yapılandırılmamış'}), 400
    try:
        # HTTPS kullanarak OAuth akışını başlat
        return redirect(url_for('github.login', _scheme='https', _external=True))
    except Exception as e:
        print(f"GitHub OAuth login hatası: {e}")
        return jsonify({'error': 'GitHub OAuth hatası'}), 500

# Fiyatlandırma/paketler sayfası
@app.route('/pricing')
def pricing():
    return render_template('pricing.html')

# Diğer endpointler eklenecek...

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    return render_template('index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=port, debug=True) 