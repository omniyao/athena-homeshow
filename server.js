/**
 * Athena Bathrooms - Home Show Activations Backend Server
 * Handles:
 * 1. Guess the Bubbles entry collection & local persistence
 * 2. Array Design Studio completion & Beyond Soap 100/day gift allocation
 * 3. Mailchimp API v3 sync & deduplication
 * 4. Staff voucher redemption API
 * 5. Kiosk / static asset serving
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const mailchimpClient = require('./mailchimp-client');
const beyondSoapManager = require('./beyond-soap-manager');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '../frontend')));

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const BUBBLES_DB = path.join(DATA_DIR, 'entries_bubbles.json');
const ARRAY_DB = path.join(DATA_DIR, 'entries_array.json');

function appendRecord(filePath, record) {
  let list = [];
  if (fs.existsSync(filePath)) {
    try {
      list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      list = [];
    }
  }
  list.push(record);
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
}

// -------------------------------------------------------------
// ENDPOINT: Guess the Bubbles Form Submission
// -------------------------------------------------------------
app.post('/api/bubbles-entry', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobile,
      address,
      postcode,
      bubbleGuess,
      nominatedPrize,
      agreeTerms,
      marketingConsent,
      event
    } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !mobile || !postcode || !bubbleGuess || !nominatedPrize) {
      return res.status(400).json({ error: 'Missing required entry fields.' });
    }

    if (!agreeTerms) {
      return res.status(400).json({ error: 'You must accept the competition Terms & Conditions.' });
    }

    const entryRecord = {
      id: 'BBL-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      firstName,
      lastName,
      email: email.toLowerCase().trim(),
      mobile,
      address,
      postcode,
      bubbleGuess: Number(bubbleGuess),
      nominatedPrize,
      marketingConsent: Boolean(marketingConsent),
      event: event || 'Home Show Auckland 2026',
      submittedAt: new Date().toISOString()
    };

    // 1. Save entry to secure competition database (independent of marketing opt-in)
    appendRecord(BUBBLES_DB, entryRecord);

    // 2. Sync / Upsert to Mailchimp Audience
    const mcResult = await mailchimpClient.syncBubblesEntry(entryRecord);

    console.log(`[Bubbles Entry Logged] ${entryRecord.email} - Guess: ${entryRecord.bubbleGuess} - Prize: ${entryRecord.nominatedPrize}`);

    return res.status(200).json({
      success: true,
      message: 'Competition entry successfully recorded.',
      entryId: entryRecord.id,
      mailchimpSynced: mcResult.success
    });
  } catch (error) {
    console.error('[API Error /bubbles-entry]:', error);
    return res.status(500).json({ error: 'Internal server error processing entry.' });
  }
});

// -------------------------------------------------------------
// ENDPOINT: Array Design Studio Submission
// -------------------------------------------------------------
app.post('/api/array-design', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobile,
      address,
      postcode,
      configuration,
      arrayUrl,
      marketingConsent,
      event
    } = req.body;

    if (!email || !firstName) {
      return res.status(400).json({ error: 'Missing required customer details.' });
    }

    const showLocation = event || 'Home Show Auckland 2026';

    // 1. Process Beyond Soap 100/day logic
    const soapResult = beyondSoapManager.processArraySubmission(email, showLocation);

    // Build or fallback the exact reopening URL for Mailchimp
    const finalArrayUrl = arrayUrl || (function() {
      if (configuration && typeof configuration === 'object') {
        const p = [];
        if (configuration.finish) p.push('finish=' + encodeURIComponent(configuration.finish));
        if (configuration.size) p.push('size=' + encodeURIComponent(String(configuration.size).replace(/mm/i, '')));
        if (configuration.style) p.push('style=' + encodeURIComponent(configuration.style));
        if (configuration.drawer) p.push('drawer=' + encodeURIComponent(configuration.drawer));
        if (configuration.topMaterial) p.push('top=' + encodeURIComponent(configuration.topMaterial));
        if (configuration.mounting) p.push('mounting=' + encodeURIComponent(configuration.mounting));
        if (configuration.internalDrawer) p.push('internal=' + encodeURIComponent(configuration.internalDrawer));
        if (configuration.handle) p.push('handle=' + encodeURIComponent(configuration.handle));
        p.push('step=5');
        return 'https://athena.co.nz/pages/array-builder?' + p.join('&');
      }
      return 'https://athena.co.nz/pages/array-builder';
    })();

    const submissionRecord = {
      id: 'ARR-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      firstName,
      lastName,
      email: email.toLowerCase().trim(),
      mobile,
      address,
      postcode,
      configuration,
      arrayUrl: finalArrayUrl,
      soapResult,
      marketingConsent: Boolean(marketingConsent),
      event: showLocation,
      submittedAt: new Date().toISOString()
    };

    // 2. Store to Array records
    appendRecord(ARRAY_DB, submissionRecord);

    // 3. Sync / Upsert to Mailchimp
    const mcResult = await mailchimpClient.syncArraySubmission(submissionRecord, soapResult);

    console.log(`[Array Studio Logged] ${submissionRecord.email} - Beyond Soap: ${soapResult.isEligible ? 'ELIGIBLE (' + soapResult.voucherCode + ')' : 'OVER LIMIT'}`);

    return res.status(200).json({
      success: true,
      message: 'Array design successfully processed.',
      beyondSoap: soapResult,
      mailchimpSynced: mcResult.success
    });
  } catch (error) {
    console.error('[API Error /array-design]:', error);
    return res.status(500).json({ error: 'Internal server error processing Array design.' });
  }
});

// -------------------------------------------------------------
// ENDPOINT: Beyond Soap Staff Voucher Redemption
// -------------------------------------------------------------
app.post('/api/beyond-soap/redeem', (req, res) => {
  const { voucherCode, pin } = req.body;
  const expectedPin = process.env.STAFF_PIN || '8842';

  if (pin !== expectedPin) {
    return res.status(401).json({ success: false, message: 'Invalid staff PIN.' });
  }

  if (!voucherCode) {
    return res.status(400).json({ success: false, message: 'Voucher code is required.' });
  }

  const result = beyondSoapManager.redeemVoucher(voucherCode);
  return res.json(result);
});

// -------------------------------------------------------------
// ENDPOINT: Campaign Reporting & Analytics
// -------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  const readSafe = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      return [];
    }
  };

  const bubbles = readSafe(BUBBLES_DB);
  const array = readSafe(ARRAY_DB);
  const soapStats = beyondSoapManager.getStats();

  // Deduplication overlap
  const bubbleEmails = new Set(bubbles.map(b => b.email));
  const arrayEmails = new Set(array.map(a => a.email));
  const overlapped = [...bubbleEmails].filter(e => arrayEmails.has(e));

  return res.json({
    totalBubblesEntries: bubbles.length,
    totalArraySubmissions: array.length,
    uniqueBubblesEntrants: bubbleEmails.size,
    uniqueArrayEntrants: arrayEmails.size,
    bothActivationsCount: overlapped.length,
    marketingOptInRateBubbles: bubbles.length ? (bubbles.filter(b => b.marketingConsent).length / bubbles.length * 100).toFixed(1) + '%' : '0%',
    beyondSoapStats: soapStats
  });
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` Athena Home Show Server running on port ${PORT}`);
  console.log(` Stand Web App: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
