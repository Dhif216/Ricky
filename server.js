const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'visits.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const loginAttempts = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '4kb' }));
app.use(express.static(path.join(__dirname, 'public')));

let writeQueue = Promise.resolve();

function browserFromUserAgent(userAgent = '') {
  if (/Edg\//i.test(userAgent)) return 'Edge';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return 'Chrome';
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'Safari';
  return 'Other';
}

function deviceFromUserAgent(userAgent = '') {
  if (/iPad|Tablet/i.test(userAgent)) return 'Tablet';
  if (/Mobi|Android|iPhone/i.test(userAgent)) return 'Mobile';
  return 'Desktop';
}

async function readVisits() {
  try {
    const contents = await fs.readFile(EVENTS_FILE, 'utf8');
    const visits = JSON.parse(contents);
    return Array.isArray(visits) ? visits : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function getClientIp(req) {
  // trust proxy is intentionally not enabled: only accept the connection's peer IP.
  const ip = req.socket.remoteAddress || req.ip || 'unknown';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function isPublicIp(ip) {
  if (net.isIP(ip) === 0) return false;
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return false;
  if (ip.includes('.')) {
    const octets = ip.split('.').map(Number);
    return !(octets[0] === 10 || octets[0] === 127 || octets[0] === 0
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168));
  }
  return true;
}

async function approximateLocation(ip) {
  if (!isPublicIp(ip)) return { city: 'Local network', region: '', country: '' };
  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { 'User-Agent': 'RickyMarket/1.0' },
      signal: AbortSignal.timeout(3500)
    });
    if (!response.ok) return { city: 'Unavailable', region: '', country: '' };
    const result = await response.json();
    return {
      city: typeof result.city === 'string' ? result.city.slice(0, 100) : 'Unknown',
      region: typeof result.region === 'string' ? result.region.slice(0, 100) : '',
      country: typeof result.country_name === 'string' ? result.country_name.slice(0, 100) : ''
    };
  } catch {
    return { city: 'Unavailable', region: '', country: '' };
  }
}

function signSession(expiresAt) {
  return crypto.createHmac('sha256', ADMIN_PASSWORD).update(String(expiresAt)).digest('base64url');
}

function hasAdminSession(req) {
  if (!ADMIN_PASSWORD) return false;
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('ricky_market_admin='))?.slice('ricky_market_admin='.length);
  if (!cookie) return false;
  const [expiryText, signature] = cookie.split('.');
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry < Date.now() || !signature) return false;
  const expected = Buffer.from(signSession(expiry));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

function requireAdmin(req, res, next) {
  if (!hasAdminSession(req)) return res.status(401).json({ error: 'Please log in to the admin dashboard.' });
  next();
}

app.post('/api/analytics/visit', async (req, res) => {
  if (req.body?.consent !== true) {
    return res.status(400).json({ error: 'Analytics consent is required.' });
  }

  const screenWidth = Number(req.body.screenWidth);
  const screenHeight = Number(req.body.screenHeight);
  if (!Number.isInteger(screenWidth) || !Number.isInteger(screenHeight)
      || screenWidth < 1 || screenHeight < 1 || screenWidth > 10000 || screenHeight > 10000) {
    return res.status(400).json({ error: 'Invalid screen dimensions.' });
  }

  let gps;
  if (req.body.gpsConsent === true) {
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
        || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Valid location permission and coordinates are required.' });
    }
    gps = { latitude, longitude };
  }

  const ip = getClientIp(req);
  const location = await approximateLocation(ip);
  const visit = {
    timestamp: new Date().toISOString(),
    ip,
    location,
    browser: browserFromUserAgent(req.get('user-agent')),
    device: deviceFromUserAgent(req.get('user-agent')),
    screen: `${screenWidth}×${screenHeight}`
  };
  if (gps) visit.gps = gps;

  const saveOperation = writeQueue.catch(() => {}).then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const visits = await readVisits();
    visits.push(visit);
    await fs.writeFile(EVENTS_FILE, `${JSON.stringify(visits.slice(-5000), null, 2)}\n`, 'utf8');
  });
  writeQueue = saveOperation;

  saveOperation.then(() => res.status(201).json({ ok: true })).catch((error) => {
    console.error('Could not save anonymous analytics event:', error.message);
    res.status(500).json({ error: 'Could not save analytics event.' });
  });
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Set ADMIN_PASSWORD in your environment before starting the server.' });
  const ip = getClientIp(req);
  const attempt = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  if (attempt.blockedUntil > Date.now()) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const provided = typeof req.body?.password === 'string' ? req.body.password : '';
  const expectedHash = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
    attempt.count += 1;
    if (attempt.count >= 5) {
      attempt.count = 0;
      attempt.blockedUntil = Date.now() + 10 * 60 * 1000;
    }
    loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: 'That password did not match.' });
  }
  loginAttempts.delete(ip);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `ricky_market_admin=${expiresAt}.${signSession(expiresAt)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'ricky_market_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/visits', requireAdmin, async (_req, res) => {
  try {
    const visits = await readVisits();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ visits: visits.slice().reverse() });
  } catch (error) {
    console.error('Could not read analytics events:', error.message);
    res.status(500).json({ error: 'Could not read analytics events.' });
  }
});

app.delete('/api/admin/visits', requireAdmin, async (_req, res) => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(EVENTS_FILE, '[]\n', 'utf8');
    res.json({ ok: true });
  } catch (error) {
    console.error('Could not clear analytics events:', error.message);
    res.status(500).json({ error: 'Could not clear analytics events.' });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Ricky Market is ready at http://localhost:${PORT}`);
});
