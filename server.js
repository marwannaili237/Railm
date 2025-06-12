const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

const faucetId = 'a084da04-862d-499f-8d09-fdfc94e5f190';
const baseUrl = 'https://sepolia-faucet.pk910.de/api/mining/';
const logFile = 'status.log';

function logStatus(message) {
  const log = `[{new Date().toISOString()}] {message}\n`;
  fs.appendFileSync(logFile, log);
  console.log(log.trim());
}

async function getChallenge() {
  try {
    const res = await axios.get(baseUrl + faucetId);
    return res.data;
  } catch (e) {
    logStatus("❌ Failed to get challenge: " + e.message);
    return null;
  }
}

function solveChallenge(challenge, difficulty) {
  const target = '0'.repeat(difficulty);
  let nonce = 0;

  while (true) {
    const input = `${challenge}${nonce}`;
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    if (hash.startsWith(target)) {
      return { nonce, hash };
    }
    nonce++;
  }
}

async function submitSolution(challenge, nonce, hash) {
  try {
    const res = await axios.post(baseUrl + faucetId, { challenge, nonce, hash });
    return res.data;
  } catch (e) {
    logStatus("❌ Submission failed: " + e.message);
    return null;
  }
}

async function mineLoop() {
  logStatus("⛏️ Faucet miner started...");
  while (true) {
    const data = await getChallenge();
    if (!data) {
      await new Promise(r => setTimeout(r, 15000));
      continue;
    }

    const { challenge, difficulty } = data;
    logStatus(`🔓 Solving challenge with difficulty ${difficulty}...`);
    const { nonce, hash } = solveChallenge(challenge, difficulty);
    logStatus(`✅ Solved: nonce=${nonce}, hash=${hash}`);

    const result = await submitSolution(challenge, nonce, hash);
    if (result) {
      logStatus("🎉 Faucet response: " + JSON.stringify(result));
    }

    await new Promise(r => setTimeout(r, 20000));
  }
}

mineLoop();

// Endpoint to view live status
app.get('/status', (req, res) => {
  fs.readFile(logFile, 'utf8', (err, data) => {
    if (err) return res.send("No log available.");
    res.type('text/plain').send(data);
  });
});

app.use('/', express.static('public'));

app.listen(PORT, () => {
  logStatus(`🌐 Server running on port ${PORT}`);
});