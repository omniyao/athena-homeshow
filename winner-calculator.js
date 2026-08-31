/**
 * Guess the Bubbles - Official Winner Calculation & Tie-Breaking Engine
 * 
 * Usage:
 *   node winner-calculator.js --event "Auckland" --actual 1428
 *   node winner-calculator.js --event "Christchurch" --actual 980
 */

const fs = require('fs');
const path = require('path');

// CLI Arguments Parser
const args = process.argv.slice(2);
let eventArg = 'auckland';
let actualCountArg = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--event' && args[i + 1]) {
    eventArg = args[i + 1].toLowerCase();
  }
  if (args[i] === '--actual' && args[i + 1]) {
    actualCountArg = parseInt(args[i + 1], 10);
  }
}

if (!actualCountArg || isNaN(actualCountArg)) {
  console.log(`
=============================================================================
 ATHENA GUESS THE BUBBLES - WINNER CALCULATOR
=============================================================================
ERROR: Please provide the audited actual bubble count.

Example usage:
  node winner-calculator.js --event auckland --actual 1428
  node winner-calculator.js --event christchurch --actual 980
=============================================================================
  `);
  process.exit(1);
}

const DB_FILE = path.join(__dirname, 'data', 'entries_bubbles.json');

if (!fs.existsSync(DB_FILE)) {
  console.error(`Error: Database file not found at ${DB_FILE}`);
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

// Filter entries by event
const eventFilterStr = eventArg.includes('christchurch') ? 'Christchurch' : 'Auckland';
const eligibleEntries = rawData.filter(entry => 
  (entry.event || '').toLowerCase().includes(eventFilterStr.toLowerCase())
);

console.log(`\nAnalyzing ${eligibleEntries.length} total entries for Home Show ${eventFilterStr} 2026...`);
console.log(`Audited Actual Bubble Count: ${actualCountArg}\n`);

if (eligibleEntries.length === 0) {
  console.log(`No entries found for ${eventFilterStr}.`);
  process.exit(0);
}

// Deduplication: 1 entry per person per show (keep earliest entry)
const uniqueEntrants = new Map();
eligibleEntries.forEach(entry => {
  const emailKey = entry.email.toLowerCase().trim();
  if (!uniqueEntrants.has(emailKey)) {
    uniqueEntrants.set(emailKey, entry);
  }
});

const deduplicated = Array.from(uniqueEntrants.values());
console.log(`Unique verified entrants: ${deduplicated.length}`);

// Calculate absolute differences
const scoredEntries = deduplicated.map(entry => {
  const diff = Math.abs(entry.bubbleGuess - actualCountArg);
  return {
    ...entry,
    diff
  };
});

// Sort by difference ascending
scoredEntries.sort((a, b) => a.diff - b.diff);

const minDiff = scoredEntries[0].diff;
const tiedEntries = scoredEntries.filter(e => e.diff === minDiff);

let finalWinner = null;
let tieBreakerUsed = false;

if (tiedEntries.length === 1) {
  finalWinner = tiedEntries[0];
} else {
  tieBreakerUsed = true;
  // Audited Random Draw among tied entrants
  const randomIndex = Math.floor(Math.random() * tiedEntries.length);
  finalWinner = tiedEntries[randomIndex];
}

console.log(`
=============================================================================
 🏆 ATHENA GUESS THE BUBBLES - WINNER DETERMINATION RESULT 🏆
=============================================================================
 Event:               Home Show ${eventFilterStr} 2026
 Audited Bubbles:     ${actualCountArg}
 Total Valid Entries: ${deduplicated.length}
 Closest Difference:  ${minDiff} bubble(s)
 Tied Top Entrants:   ${tiedEntries.length} ${tieBreakerUsed ? '(Random Draw Performed)' : ''}

 ---------------------------------------------------------------------------
 WINNER DETAILS:
 ---------------------------------------------------------------------------
 Name:            ${finalWinner.firstName} ${finalWinner.lastName}
 Email:           ${finalWinner.email}
 Mobile:          ${finalWinner.mobile}
 Address:         ${finalWinner.address}, ${finalWinner.postcode}
 Winning Guess:   ${finalWinner.bubbleGuess}
 Nominated Prize: ${finalWinner.nominatedPrize}
 Submission Time: ${finalWinner.submittedAt}
=============================================================================
`);

// Export CSV results
const csvRows = [
  'Rank,First Name,Last Name,Email,Mobile,Postcode,Guess,Difference,Nominated Prize,Is Winner,Marketing Opt-In,Submission Time'
];

scoredEntries.forEach((entry, idx) => {
  const isWinner = entry.email === finalWinner.email ? 'YES (WINNER)' : 'No';
  csvRows.push([
    idx + 1,
    `"${entry.firstName}"`,
    `"${entry.lastName}"`,
    `"${entry.email}"`,
    `"${entry.mobile}"`,
    `"${entry.postcode}"`,
    entry.bubbleGuess,
    entry.diff,
    `"${entry.nominatedPrize}"`,
    `"${isWinner}"`,
    entry.marketingConsent ? 'Yes' : 'No',
    `"${entry.submittedAt}"`
  ].join(','));
});

const reportPath = path.join(__dirname, 'data', `winner_report_${eventFilterStr.toLowerCase()}_${Date.now()}.csv`);
fs.writeFileSync(reportPath, csvRows.join('\n'));
console.log(`Full CSV report generated at: ${reportPath}\n`);
