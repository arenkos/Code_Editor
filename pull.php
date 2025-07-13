<?php
// GitHub webhook için pull.php
header('Content-Type: application/json');

// Log dosyası
$logFile = '/var/www/html/webhook.log';

// Log fonksiyonu
function writeLog($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

writeLog("Webhook tetiklendi");

// GitHub'dan gelen payload'ı al
$payload = file_get_contents('php://input');
$data = json_decode($payload, true);

// Sadece push eventlerini işle
if ($_SERVER['HTTP_X_GITHUB_EVENT'] !== 'push') {
    writeLog("Push event değil, atlanıyor");
    echo json_encode(['message' => 'Not a push event']);
    exit;
}

// Repository kontrolü
$repoName = $data['repository']['name'] ?? '';
if ($repoName !== 'Code_Editor') {
    writeLog("Yanlış repository: $repoName");
    echo json_encode(['error' => 'Wrong repository']);
    exit;
}

writeLog("Repository doğru: $repoName");

// Code-editor dizinine git
$repoPath = '/root/code-editor';
if (!is_dir($repoPath)) {
    writeLog("Repository dizini bulunamadı: $repoPath");
    http_response_code(500);
    echo json_encode(['error' => 'Repository directory not found']);
    exit;
}

// Git pull işlemi
chdir($repoPath);
$gitPull = shell_exec('git pull origin main 2>&1');
writeLog("Git pull çıktısı: $gitPull");

// Node.js dependencies güncelle (eğer package.json değiştiyse)
if (file_exists('package.json')) {
    $npmInstall = shell_exec('npm install 2>&1');
    writeLog("NPM install çıktısı: $npmInstall");
}

// React build
$npmBuild = shell_exec('npm run build 2>&1');
writeLog("NPM build çıktısı: $npmBuild");

// PM2 ile Node.js uygulamasını yeniden başlat
$pm2Restart = shell_exec('pm2 restart code-editor 2>&1');
writeLog("PM2 restart çıktısı: $pm2Restart");

// Başarılı yanıt
echo json_encode([
    'success' => true,
    'message' => 'Deployment completed',
    'git_pull' => $gitPull,
    'npm_install' => $npmInstall ?? 'No package.json changes',
    'npm_build' => $npmBuild,
    'pm2_restart' => $pm2Restart
]);

writeLog("Deployment tamamlandı");
?>