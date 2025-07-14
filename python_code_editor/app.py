from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
import os
import subprocess
import threading
from pathlib import Path

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app)

# Terminal oturumları için basit bir store
terminal_sessions = {}

# Ana dizin (güvenlik için sadece buraya erişim verilecek)
ALLOWED_PATHS = ["/"]

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

# Diğer endpointler eklenecek...

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    return render_template('index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=port, debug=True) 