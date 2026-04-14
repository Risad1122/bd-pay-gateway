const express = require('express');
const app = express();
app.use(express.json());

const BOT_TOKEN = '8729796921:AAG-rfsGGe-3aZTJ3C-vXh58-PYWa1wGhjQ';
const FIREBASE_URL = 'https://admin-testing-2031c-default-rtdb.firebaseio.com';

function parseBkash(text) {
  const amount = text.match(/received Tk ([\d,]+\.?\d*)/i);
  const trx = text.match(/TrxID\s+([A-Z0-9]+)/i);
  const sender = text.match(/from\s+(01\d{9})/);
  if (amount && trx) return { method:'bKash', amount:parseFloat(amount[1].replace(/,/g,'')), trxId:trx[1], sender:sender?sender[1]:'Unknown' };
  return null;
}

function parseNagad(text) {
  const amount = text.match(/received\s+(?:BDT|Tk|৳)\s*([\d,]+\.?\d*)/i) || text.match(/৳\s*([\d,]+\.?\d*)/);
  const trx = text.match(/TrxID[:\s]+([A-Z0-9]+)/i);
  const sender = text.match(/from\s+(01\d{9})/);
  if (amount && trx) return { method:'Nagad', amount:parseFloat(amount[1].replace(/,/g,'')), trxId:trx[1], sender:sender?sender[1]:'Unknown' };
  return null;
}

function parse(text) {
  const u = text.toUpperCase();
  if (u.includes('BKASH') || text.includes('received Tk')) return parseBkash(text);
  if (u.includes('NAGAD')) return parseNagad(text);
  return null;
}

async function saveFirebase(data) {
  const check = await fetch(`${FIREBASE_URL}/AutoPay/${data.trxId}.json`);
  const existing = await check.json();
  if (existing) return false;
  await fetch(`${FIREBASE_URL}/AutoPay/${data.trxId}.json`, {
    method:'PUT',
    body: JSON.stringify({ txid:data.trxId, amount:data.amount, method:data.method, sender:data.sender, time:new Date().toISOString(), used:false })
  });
  return true;
}

async function sendTG(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id:chatId, text })
  });
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body?.message;
  if (!msg?.text) return;
  const parsed = parse(msg.text);
  if (!parsed) return;
  const saved = await saveFirebase(parsed);
  if (saved) {
    await sendTG(msg.chat.id, `✅ Payment Verified!\n\n💰 Amount: ৳${parsed.amount}\n🔑 TrxID: ${parsed.trxId}\n📱 Method: ${parsed.method}\n⏰ ${new Date().toLocaleString()}`);
  }
});

app.get('/', (req, res) => res.send('BD Pay Gateway Running!'));
app.listen(3000, () => console.log('Server running on port 3000'));
