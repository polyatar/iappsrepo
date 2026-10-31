<?php
/*
 * Приём UDID для iappscert.com/udid  (вариант на PHP)
 *
 *   GET  /udid/api.php?a=profile   — отдаёт профиль, который скачивает пользователь на странице /udid/
 *   POST /udid/api.php?a=receive   — сюда iPhone при установке профиля присылает подписанный plist с UDID;
 *                                    ответ: 301 на /udid/#udid=...  (данные в «#» на сервер не попадают и в журналы не пишутся)
 * Ничего не сохраняется и не логируется. Положите файл рядом со страницей: /udid/api.php
 */
declare(strict_types=1);

// ---- настройки ----
const SITE_HOSTS = ['iappscert.com', 'www.iappscert.com'];   // допустимые домены
const SCHEME     = 'https';
const PAGE       = '/udid/';                                  // страница с результатом
// Необязательно: подпись профиля сертификатом сайта (с ней iPhone показывает «Проверено», а не «Не подписан»).
// Укажите пути к PEM-файлам, например Let's Encrypt: cert.pem, privkey.pem, chain.pem
const SIGN_CERT  = '';
const SIGN_KEY   = '';
const SIGN_CHAIN = '';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

// домен берём из запроса, но только из списка допустимых (защита от подмены заголовка Host)
function site_base(): string
{
    $raw  = strtolower(trim(explode(',', (string)($_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? ''))[0]));
    $only = (string)preg_replace('/:\d+$/', '', $raw);
    $host = in_array($only, SITE_HOSTS, true) ? $raw : SITE_HOSTS[0];
    return SCHEME . '://' . $host;
}

function xml_esc(string $s): string
{
    return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    $h = bin2hex($b);
    return strtoupper(substr($h, 0, 8) . '-' . substr($h, 8, 4) . '-' . substr($h, 12, 4) . '-' . substr($h, 16, 4) . '-' . substr($h, 20, 12));
}

function profile_xml(string $base): string
{
    $url  = xml_esc($base . PAGE . 'api.php?a=receive');
    $uuid = uuid4();
    return '<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <dict>
        <key>URL</key>
        <string>' . $url . '</string>
        <key>DeviceAttributes</key>
        <array>
            <string>UDID</string>
            <string>PRODUCT</string>
            <string>VERSION</string>
        </array>
    </dict>
    <key>PayloadOrganization</key>
    <string>iApps</string>
    <key>PayloadDisplayName</key>
    <string>iApps: UDID</string>
    <key>PayloadDescription</key>
    <string>Профиль нужен один раз, чтобы определить UDID вашего устройства. Он ничего не меняет и не остаётся на устройстве. / One-time profile to read your device UDID. It changes nothing and is not kept on the device.</string>
    <key>PayloadIdentifier</key>
    <string>com.iapps.udid</string>
    <key>PayloadUUID</key>
    <string>' . $uuid . '</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadType</key>
    <string>Profile Service</string>
</dict>
</plist>
';
}

// подпись профиля (необязательно): S/MIME от openssl -> DER; при любой ошибке отдаём профиль без подписи
function sign_profile(string $xml): ?string
{
    if (SIGN_CERT === '' || SIGN_KEY === '' || !function_exists('openssl_pkcs7_sign')) {
        return null;
    }
    $in  = tempnam(sys_get_temp_dir(), 'udid');
    $out = tempnam(sys_get_temp_dir(), 'udid');
    if ($in === false || $out === false) {
        return null;
    }
    file_put_contents($in, $xml);
    $chain = SIGN_CHAIN !== '' ? SIGN_CHAIN : null;
    $ok    = @openssl_pkcs7_sign($in, $out, 'file://' . SIGN_CERT, ['file://' . SIGN_KEY, ''], [], PKCS7_BINARY, $chain);
    $smime = $ok ? (string)file_get_contents($out) : '';
    @unlink($in);
    @unlink($out);
    $parts = preg_split("/\r?\n\r?\n/", $smime, 2);
    if (!$ok || $parts === false || count($parts) < 2) {
        return null;
    }
    $der = base64_decode(trim($parts[1]), true);
    return $der === false ? null : $der;
}

// из подписанного ответа iPhone достаём открытый plist и значения полей
function parse_device(string $buf): ?array
{
    $a = strpos($buf, '<?xml');
    $b = strpos($buf, '</plist>');
    if ($a === false || $b === false || $b < $a) {
        return null;
    }
    $xml = substr($buf, $a, $b + 8 - $a);
    $get = function (string $key) use ($xml): string {
        return preg_match('~<key>' . $key . '</key>\s*<string>([^<]*)</string>~', $xml, $m) ? trim($m[1]) : '';
    };
    $udid = $get('UDID');
    if (!preg_match('/^[0-9A-Fa-f-]{8,64}$/', $udid)) {
        return null;
    }
    $product = $get('PRODUCT');
    $version = $get('VERSION');
    return [
        'udid'    => $udid,
        'product' => preg_match('/^[A-Za-z0-9,._ -]{1,40}$/', $product) ? $product : '',
        'version' => preg_match('/^[0-9A-Za-z._ ()-]{1,40}$/', $version) ? $version : '',
    ];
}

// iOS принимает только 301
function go(string $url): void
{
    header('Location: ' . $url, true, 301);
    header('Content-Length: 0');
    exit;
}

$action = (string)($_GET['a'] ?? '');
$method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');
$base   = site_base();

if ($action === 'profile' && $method === 'GET') {
    $xml = profile_xml($base);
    $body = sign_profile($xml) ?? $xml;
    header('Content-Type: application/x-apple-aspen-config');
    header('Content-Disposition: attachment; filename="iapps-udid.mobileconfig"');
    header('Content-Length: ' . strlen($body));
    echo $body;
    exit;
}

if ($action === 'receive') {
    if ($method !== 'POST') {
        go($base . PAGE);                                    // открыли адрес вручную
    }
    $raw = (string)file_get_contents('php://input', false, null, 0, 1048576);
    $dev = parse_device($raw);
    if ($dev === null) {
        go($base . PAGE . '#error=1');
    }
    $hash = 'udid=' . rawurlencode($dev['udid'])
        . ($dev['product'] !== '' ? '&product=' . rawurlencode($dev['product']) : '')
        . ($dev['version'] !== '' ? '&version=' . rawurlencode($dev['version']) : '');
    go($base . PAGE . '#' . $hash);
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Not found';
