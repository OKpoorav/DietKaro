/**
 * Quick one-off email test — run with:
 *   npx tsx test-email.ts
 */
import 'dotenv/config';

const API_KEY = process.env.ELASTIC_EMAIL_PASS;
const FROM = process.env.EMAIL_FROM_ADDRESS || 'no-reply@healthpractix.com';
const TO = process.argv[2] || 'hipoorav@gmail.com';

async function main() {
    if (!API_KEY) { console.error('ELASTIC_EMAIL_PASS not set'); process.exit(1); }
    console.log(`Sending to ${TO} from ${FROM}...`);

    const params = new URLSearchParams({
        apikey: API_KEY,
        from: FROM,
        fromName: 'HealthPractix',
        to: TO,
        subject: 'HealthPractix test email',
        bodyHtml: '<h1>Hello!</h1><p>This is a test from HealthPractix.</p>',
        isTransactional: 'true',
    });

    const res = await fetch('https://api.elasticemail.com/v2/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    const text = await res.text();
    console.log('HTTP status:', res.status);
    console.log('Response body:', text);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
