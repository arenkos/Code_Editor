from flask import Flask, request, jsonify, send_from_directory, render_template, after_this_request
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

@app.route('/api/terminal', methods=['POST'])
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

@app.route('/api/ai-agent', methods=['POST'])
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

# Diğer endpointler eklenecek...

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    return render_template('index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=port, debug=True) 