<?php
// Contactformulier van darkesttimes.nl: controleert het bericht en verstuurt het via Migadu (formulier@ -> info@).
// Caddy stuurt POST /api/contact hierheen. Wachtwoord en adressen staan in .env (zie compose.yml).
// Lukt versturen niet, of is de daglimiet bereikt, dan wordt het bericht bewaard en elk uur opnieuw geprobeerd
// (lib/bewaard-versturen.php). De bezoeker krijgt dan gewoon "verstuurd" te zien.

require '/app/lib/mail.php';

const MAX_PER_IP_PER_UUR = 5;
const TELLER = '/app/data/teller.json';   // per bezoeker per uur; de daglimiet zit in lib/mail.php

$wilJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');

function antwoord(int $status, string $tekst): never {
    global $wilJson;
    http_response_code($status);
    if ($wilJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $status < 300, 'bericht' => $tekst]);
    } else {
        // Zonder JavaScript: een simpele pagina met een link terug
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
            . '<title>Contact</title><body style="font-family:system-ui;background:#000;color:#fff;padding:2rem">'
            . '<p>' . htmlspecialchars($tekst) . '</p><p><a href="/#contact" style="color:#b9a6ff">Terug naar de site</a></p>';
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    antwoord(405, 'Alleen versturen via het formulier.');
}

$veld = fn(string $naam, int $max) => mb_substr(trim((string)($_POST[$naam] ?? '')), 0, $max);
$naam    = $veld('naam', 100);
$email   = $veld('email', 200);
$branche = $veld('branche', 100);
$bericht = $veld('bericht', 5000);

// Honeypot: dit veld is onzichtbaar voor mensen, alleen bots vullen het in. Doe alsof het gelukt is.
if ($veld('website', 200) !== '') {
    antwoord(200, 'Bedankt! Je bericht is verstuurd.');
}

if ($naam === '' || $bericht === '') {
    antwoord(422, 'Vul je naam en een bericht in.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    antwoord(422, 'Dat e-mailadres klopt niet helemaal.');
}
$naam = str_replace(["\r", "\n"], ' ', $naam);
$branche = str_replace(["\r", "\n"], ' ', $branche);

// Teller tegen misbruik: per IP-adres per uur
$fp = fopen(TELLER, 'c+');
flock($fp, LOCK_EX);
$teller = json_decode(stream_get_contents($fp) ?: '{}', true) ?: [];
$nu = time();
$ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
foreach ($teller['ip'] ?? [] as $k => $tijden) {
    $teller['ip'][$k] = array_values(array_filter($tijden, fn($t) => $t > $nu - 3600));
    if (!$teller['ip'][$k]) unset($teller['ip'][$k]);
}
$teVeel = count($teller['ip'][$ip] ?? []) >= MAX_PER_IP_PER_UUR;
if (!$teVeel) {
    $teller['ip'][$ip][] = $nu;
}
ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($teller));
flock($fp, LOCK_UN);
fclose($fp);
if ($teVeel) {
    antwoord(429, 'Er zijn net veel berichten verstuurd. Probeer het later nog eens, of mail naar ' . getenv('MAIL_TO') . '.');
}

$b = ['naam' => $naam, 'email' => $email, 'branche' => $branche, 'bericht' => $bericht, 'tijd' => $nu];

// Daglimiet voor formulier@: daarboven bewaren in plaats van mailen.
if (dagTeller(1) < 0) {
    bewaar($b, 'daglimiet');
} elseif (!verstuur($b)) {
    bewaar($b, 'versturen mislukt');
}

antwoord(200, 'Bedankt! Je bericht is verstuurd. Ik reageer zo snel mogelijk.');
