<?php
// scan_php_vuln.php — Détecte patterns dangereux dans le code PHP
$dir = realpath(__DIR__ . '/../../../src');
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
$dangerous = ['eval(', 'exec(', 'system(', 'shell_exec(', 'passthru(', 'base64_decode(', 'unserialize(', 'mysql_query(', 'mysqli_query(', '$_GET[', '$_POST[', '$_REQUEST['];
foreach ($iterator as $file) {
    if ($file->getExtension() === 'php') {
        $lines = file($file->getPathname());
        foreach ($lines as $i => $line) {
            foreach ($dangerous as $pattern) {
                if (strpos($line, $pattern) !== false) {
                    echo $file->getPathname() . ':' . ($i+1) . ' => ' . trim($line) . "\n";
                }
            }
        }
    }
}
