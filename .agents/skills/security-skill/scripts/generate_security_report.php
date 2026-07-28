<?php
// generate_security_report.php — Assemble le rapport global
$report = [];
$report['php_vuln'] = shell_exec('php scripts/scan_php_vuln.php');
$report['env_exposure'] = shell_exec('bash scripts/scan_env_exposure.sh');
$report['admin_rights'] = shell_exec('php scripts/scan_admin_rights.php');
$report['api_security'] = shell_exec('node scripts/scan_api_security.js');
$report['dependencies'] = shell_exec('bash scripts/scan_dependencies.sh');
file_put_contents('security_report.json', json_encode($report, JSON_PRETTY_PRINT));
echo "Rapport généré : security_report.json\n";
