<?php
$payload = file_get_contents('php://input');
$data = json_decode($payload, true);

// Güvenlik kontrolü (opsiyonel): Secret key ile doğrulama yapabilirsin

// Log tutmak istersen
file_put_contents("hook.log", date("Y-m-d H:i:s") . " - Push geldi\n", FILE_APPEND);

// Shell komutu çalıştır (örnek: git pull)
shell_exec("cd /root/code-editor && git pull 2>&1");
?>