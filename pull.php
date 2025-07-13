<?php
// Webhook payload'ı al
$payload = file_get_contents('php://input');
$data = json_decode($payload, true);

// (Opsiyonel) Secret key ile doğrulama
// $secret = 'BURAYA_SECRET_YAZ';
// $signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
// $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
// if ($signature !== $expected) {
//     file_put_contents("/var/www/html/hook.log", date("Y-m-d H:i:s") . " - Secret doğrulama hatası\n", FILE_APPEND);
//     http_response_code(401);
//     exit("Unauthorized");
// }

// Log dosyası
$logFile = "/var/www/html/hook.log";
function logMsg($msg) {
    global $logFile;
    file_put_contents($logFile, date("Y-m-d H:i:s") . " - $msg\n", FILE_APPEND);
}

logMsg("Push geldi");

// Komutları çalıştır
$repoPath = "/var/www/code-editor";
if (!is_dir($repoPath)) {
    logMsg("Repository bulunamadı: $repoPath");
    http_response_code(500);
    exit("Repository not found");
}

chdir($repoPath);

// Git pull
$gitPull = shell_exec("git pull 2>&1");
logMsg("git pull: $gitPull");

// NPM install (isteğe bağlı, package.json değiştiyse)
if (file_exists("package.json")) {
    $npmInstall = shell_exec("npm install 2>&1");
    logMsg("npm install: $npmInstall");
}

// React build
$npmBuild = shell_exec("npm run build 2>&1");
logMsg("npm run build: $npmBuild");

// PM2 restart
$pm2Restart = shell_exec("pm2 restart code-editor 2>&1");
logMsg("pm2 restart: $pm2Restart");

echo "OK";

?>