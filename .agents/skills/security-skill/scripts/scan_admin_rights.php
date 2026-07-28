<?php
// scan_admin_rights.php — Contrôle la gestion des droits admin
require_once __DIR__ . '/../../../src/config/config.php';
$sql = "SELECT id, user_name, is_admin FROM users WHERE is_admin = 1";
$stmt = $pdo->query($sql);
while ($row = $stmt->fetch()) {
    echo "Admin: {$row['user_name']} (ID: {$row['id']})\n";
}
