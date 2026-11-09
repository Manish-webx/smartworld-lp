<?php
/**
 * Experion Emerelle Reserve - Lead Handler
 * Processes lead submissions, saves backup to leads.csv, and sends notification email via PHPMailer.
 */

date_default_timezone_set('Asia/Kolkata');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';
require_once __DIR__ . '/PHPMailer/Exception.php';

// Helper to send response (JSON for AJAX, redirect/HTML for standard form POST)
function sendLeadResponse($status, $message, $redirect = 'thank-you.html', $isAjax = false) {
    if ($isAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => $status,
            'message' => $message,
            'redirect' => $redirect
        ]);
        exit;
    }

    if ($status === 'success') {
        header("Location: {$redirect}");
        exit;
    } else {
        echo "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><title>Submission Notice</title>";
        echo "<script>alert(" . json_encode($message) . "); window.history.back();</script>";
        echo "</head><body><p>" . htmlspecialchars($message) . " <a href='index.html'>Return to website</a></p></body></html>";
        exit;
    }
}

// Check if request is AJAX
$isAjax = (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
    || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)
    || (isset($_POST['ajax']) && $_POST['ajax'] === '1');

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    if ($isAjax) {
        sendLeadResponse('error', 'Method not allowed.', 'index.html', true);
    }
    header('Location: index.html');
    exit;
}

// Handle raw JSON payload if sent via application/json
$rawInput = file_get_contents('php://input');
if (!empty($rawInput) && empty($_POST)) {
    $jsonData = json_decode($rawInput, true);
    if (is_array($jsonData)) {
        $_POST = $jsonData;
    }
}

// Anti-spam Honeypot Check (bots fill this field, humans don't see it)
if (!empty($_POST['hp_field'])) {
    // Return success to confuse bots without sending any email
    sendLeadResponse('success', 'Lead received successfully.', 'thank-you.html', $isAjax);
}

// Extract & Sanitize Form Data
$name = trim(strip_tags($_POST['name'] ?? ''));
$phone = trim(strip_tags($_POST['phone'] ?? ''));
$email = trim(strip_tags($_POST['email'] ?? ''));
$config = trim(strip_tags($_POST['config'] ?? ''));
$visit = trim(strip_tags($_POST['visit'] ?? ''));
$source = trim(strip_tags($_POST['source'] ?? 'Website Form'));
$message = trim(strip_tags($_POST['message'] ?? ''));
$url = trim(strip_tags($_POST['url'] ?? ($_SERVER['HTTP_REFERER'] ?? '')));
$dpdpConsent = isset($_POST['dpdp_consent']) ? 'Yes (Consented under DPDP Act, 2023)' : 'Not recorded';

// UTM Campaign Tracking
$utm_source = trim(strip_tags($_POST['utm_source'] ?? ''));
$utm_medium = trim(strip_tags($_POST['utm_medium'] ?? ''));
$utm_campaign = trim(strip_tags($_POST['utm_campaign'] ?? ''));
$utm_term = trim(strip_tags($_POST['utm_term'] ?? ''));
$utm_content = trim(strip_tags($_POST['utm_content'] ?? ''));

// Validate Name
if (empty($name)) {
    sendLeadResponse('error', 'Please enter your full name.', 'index.html', $isAjax);
}

// Normalize & Validate Indian Mobile Number (10 digits starting with 6-9)
$cleanPhone = preg_replace('/\D/', '', $phone);
if (strlen($cleanPhone) === 12 && str_starts_with($cleanPhone, '91')) {
    $cleanPhone = substr($cleanPhone, 2);
} elseif (strlen($cleanPhone) === 11 && str_starts_with($cleanPhone, '0')) {
    $cleanPhone = substr($cleanPhone, 1);
}

if (!preg_match('/^[6-9]\d{9}$/', $cleanPhone)) {
    sendLeadResponse('error', 'Please enter a valid 10-digit mobile number.', 'index.html', $isAjax);
}

// Validate Email if provided
if (!empty($email) && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendLeadResponse('error', 'Please enter a valid email address.', 'index.html', $isAjax);
}

// Server-side validation: Disallow links & URLs in message field
$urlPattern = '/(?:[a-zA-Z]+:\/\/|www\.)[^\s]*|(?<!@)\b[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.(?:com|org|net|in|co|io|ai|biz|info|xyz|me|online|site|tech|store|app|dev|cloud|pro|link|top|vip|icu|live|click|mobi|ly|gl|be|tv|to|cc|edu|gov)\b(?:\/[^\s]*)?/i';
if (!empty($message) && preg_match($urlPattern, $message)) {
    sendLeadResponse('error', 'Links and website URLs are not allowed in the message field. Please remove them.', 'index.html', $isAjax);
}

// Submission Metadata
$submissionTime = date('d M Y, h:i:s A');
$ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

// ================= SAVE LEAD TO CSV BACKUP =================
$csvFile = __DIR__ . '/leads.csv';
$csvExists = file_exists($csvFile);
if ($handle = @fopen($csvFile, 'a')) {
    if (!$csvExists) {
        fputcsv($handle, [
            'Timestamp (IST)',
            'Name',
            'Phone',
            'Email',
            'Configuration',
            'Preferred Visit',
            'Source',
            'Message',
            'DPDP Consent',
            'IP Address',
            'Page URL',
            'UTM Source',
            'UTM Medium',
            'UTM Campaign',
            'User Agent'
        ]);
    }
    fputcsv($handle, [
        $submissionTime,
        $name,
        $cleanPhone,
        $email,
        $config,
        $visit,
        $source,
        $message,
        $dpdpConsent,
        $ipAddress,
        $url,
        $utm_source,
        $utm_medium,
        $utm_campaign,
        $userAgent
    ]);
    fclose($handle);
}

// ================= OPTIONAL CRM WEBHOOK FORWARDER =================
// Set your CRM Webhook / Google Sheet Apps Script URL here when available
$crmWebhookUrl = '';
if (!empty($crmWebhookUrl)) {
    try {
        $ch = curl_init($crmWebhookUrl);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'project'     => 'Experion Emerelle Reserve',
            'name'        => $name,
            'phone'       => $cleanPhone,
            'email'       => $email,
            'config'      => $config,
            'visit'       => $visit,
            'source'      => $source,
            'message'     => $message,
            'consent'     => $dpdpConsent,
            'url'         => $url,
            'utm_source'  => $utm_source,
            'utm_medium'  => $utm_medium,
            'utm_campaign'=> $utm_campaign,
            'timestamp'   => $submissionTime
        ]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Accept: application/json']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_exec($ch);
        curl_close($ch);
    } catch (\Throwable $th) {
        // CRM call fails gracefully without interrupting user flow
    }
}

// ================= BUILD PREMIUM HTML EMAIL =================
$subject = "New Lead: {$name} (+91 {$cleanPhone}) - Experion Emerelle Reserve";

$body = "
<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f5f1; margin: 0; padding: 24px; color: #1c1a17; }
  .card { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e7e3da; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
  .head { background: #14130f; color: #ffffff; padding: 24px 30px; border-bottom: 3px solid #c9a66b; }
  .head h2 { margin: 0 0 6px; font-size: 22px; color: #ffffff; font-weight: 600; letter-spacing: 0.5px; }
  .head p { margin: 0; font-size: 13px; color: #c9a66b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500; }
  .content { padding: 30px; }
  .badge { display: inline-block; padding: 6px 14px; background: #faf4e8; border: 1px solid #c9a66b; border-radius: 20px; font-size: 13px; font-weight: 600; color: #7f632b; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { text-align: left; padding: 12px 14px; font-size: 14px; border-bottom: 1px solid #f0ede6; }
  th { width: 34%; background: #faf9f6; color: #6b675e; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.8px; }
  td { color: #1c1a17; }
  td a { color: #8e7033; text-decoration: none; font-weight: 600; }
  .cta-box { margin-top: 24px; padding: 16px; background: #fdfbf7; border-left: 4px solid #c9a66b; border-radius: 4px; }
  .cta-box a { display: inline-block; background: #c9a66b; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; margin-right: 10px; margin-bottom: 6px; }
  .foot { background: #faf9f6; padding: 16px 30px; border-top: 1px solid #ebe7df; font-size: 12px; color: #888277; text-align: center; }
</style>
</head>
<body>
  <div class='card'>
    <div class='head'>
      <p>Experion Emerelle Reserve · Sector 88A Gurugram</p>
      <h2>New Website Lead Received</h2>
    </div>
    <div class='content'>
      <div class='badge'>Form: " . htmlspecialchars($source) . "</div>
      
      <table>
        <tr>
          <th>Client Name</th>
          <td><strong>" . htmlspecialchars($name) . "</strong></td>
        </tr>
        <tr>
          <th>Phone Number</th>
          <td><a href='tel:+91{$cleanPhone}' style='font-size:16px;font-weight:700;'>+91 {$cleanPhone}</a> &nbsp;|&nbsp; <a href='https://wa.me/91{$cleanPhone}' target='_blank'>Chat on WhatsApp</a></td>
        </tr>
        <tr>
          <th>Form Source</th>
          <td>" . htmlspecialchars($source) . "</td>
        </tr>
        <tr>
          <th>DPDP Consent</th>
          <td>" . htmlspecialchars($dpdpConsent) . "</td>
        </tr>
        <tr>
          <th>Submission Time</th>
          <td>{$submissionTime} (IST)</td>
        </tr>
        <tr>
          <th>Page URL</th>
          <td>" . (!empty($url) ? "<a href='" . htmlspecialchars($url) . "' target='_blank'>" . htmlspecialchars($url) . "</a>" : "<em>Direct</em>") . "</td>
        </tr>";

if (!empty($email)) {
    $body .= "
        <tr>
          <th>Email Address</th>
          <td><a href='mailto:" . htmlspecialchars($email) . "'>" . htmlspecialchars($email) . "</a></td>
        </tr>";
}
if (!empty($config)) {
    $body .= "
        <tr>
          <th>Interested Config</th>
          <td>" . htmlspecialchars($config) . "</td>
        </tr>";
}
if (!empty($visit)) {
    $body .= "
        <tr>
          <th>Preferred Visit</th>
          <td>" . htmlspecialchars($visit) . "</td>
        </tr>";
}
if (!empty($message)) {
    $body .= "
        <tr>
          <th>Message</th>
          <td>" . nl2br(htmlspecialchars($message)) . "</td>
        </tr>";
}

if (!empty($utm_source) || !empty($utm_campaign) || !empty($utm_medium)) {
    $body .= "
        <tr>
          <th>Campaign Tracking</th>
          <td>Source: <b>" . htmlspecialchars($utm_source) . "</b> | Medium: <b>" . htmlspecialchars($utm_medium) . "</b> | Campaign: <b>" . htmlspecialchars($utm_campaign) . "</b></td>
        </tr>";
}

$body .= "
      </table>

      <div class='cta-box'>
        <a href='tel:+91{$cleanPhone}'>📞 Call Lead Now</a>
        <a href='https://wa.me/91{$cleanPhone}?text=" . urlencode("Hi {$name}, thank you for your enquiry on Experion Emerelle Reserve, Sector 88A Gurugram. How can we assist you?") . "' target='_blank' style='background:#25D366;'>💬 WhatsApp Lead</a>
      </div>
    </div>
    <div class='foot'>
      Coming Keys (RVS COMINGKEYS PRIVATE LIMITED) · Channel Partner HRERA: RC/HARERA/GGM/3716/3311/2025/593
    </div>
  </div>
</body>
</html>";

// ================= SEND EMAIL VIA PHPMAILER =================
$mail = new PHPMailer(true);

try {
    // SMTP Settings
    $mail->isSMTP();
    $mail->Host       = 'smtp.hostinger.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'info@cognivicdigital.com';
    $mail->Password   = 'Info@987--';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->Timeout    = 15;

    // Sender & Reply-To
    $mail->setFrom('info@cognivicdigital.com', 'Experion Emerelle Reserve');
    if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $mail->addReplyTo($email, $name);
    }

    // Recipients
    $mail->addAddress('manishkushwahaf7@gmail.com', 'Lead Admin');
    $mail->addAddress('info@comingkeys.com', 'Coming Keys');

    // Email Content
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $body;
    $mail->AltBody = "New Lead: {$name}\nPhone: +91 {$cleanPhone}\nEmail: {$email}\nConfig: {$config}\nVisit: {$visit}\nSource: {$source}\nMessage: {$message}\nConsent: {$dpdpConsent}\nDate: {$submissionTime}";

    $mail->send();

    $redirectTarget = 'thank-you.html?name=' . urlencode($name);
    sendLeadResponse('success', 'Thank you! Your enquiry has been received.', $redirectTarget, $isAjax);

} catch (Exception $e) {
    error_log("Mail Error: {$mail->ErrorInfo}");
    // Lead is safely recorded in leads.csv even if SMTP throws an error
    $redirectTarget = 'thank-you.html?name=' . urlencode($name);
    sendLeadResponse('success', 'Your enquiry has been received.', $redirectTarget, $isAjax);
}
