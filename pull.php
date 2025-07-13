<?php
// GitHub Webhook Handler
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Log dosyası yolu
$logFile = __DIR__ . '/webhook.log';
$gitLogFile = __DIR__ . '/git.log';

// Webhook verilerini al
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Log başlangıcı
$logEntry = date('Y-m-d H:i:s') . " - Webhook tetiklendi\n";
file_put_contents($logFile, $logEntry, FILE_APPEND);

// GitHub webhook doğrulama (opsiyonel)
$headers = getallheaders();
$signature = isset($headers['X-Hub-Signature-256']) ? $headers['X-Hub-Signature-256'] : '';

// Webhook verilerini logla
$logEntry = date('Y-m-d H:i:s') . " - Payload: " . $input . "\n";
file_put_contents($logFile, $logEntry, FILE_APPEND);

// Sadece push eventlerini işle
if (isset($data['ref']) && strpos($data['ref'], 'refs/heads/') === 0) {
    $branch = str_replace('refs/heads/', '', $data['ref']);
    
    $logEntry = date('Y-m-d H:i:s') . " - Branch: " . $branch . "\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND);
    
    // Git pull işlemi
    $repoPath = '/root/code-editor';
    
    // Git durumunu kontrol et
    $gitStatus = shell_exec("cd $repoPath && git status 2>&1");
    $logEntry = date('Y-m-d H:i:s') . " - Git Status: " . $gitStatus . "\n";
    file_put_contents($gitLogFile, $logEntry, FILE_APPEND);
    
    // Git pull yap
    $gitPull = shell_exec("cd $repoPath && git pull origin $branch 2>&1");
    $logEntry = date('Y-m-d H:i:s') . " - Git Pull Output: " . $gitPull . "\n";
    file_put_contents($gitLogFile, $logEntry, FILE_APPEND);
    
    // Sonuç
    $response = [
        'status' => 'success',
        'message' => 'Webhook processed successfully',
        'branch' => $branch,
        'git_output' => $gitPull
    ];
    
    $logEntry = date('Y-m-d H:i:s') . " - Success: Branch $branch updated\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND);
    
} else {
    $response = [
        'status' => 'ignored',
        'message' => 'Not a push event or invalid ref'
    ];
    
    $logEntry = date('Y-m-d H:i:s') . " - Ignored: Not a push event\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}

// JSON response
header('Content-Type: application/json');
echo json_encode($response, JSON_PRETTY_PRINT);
?>