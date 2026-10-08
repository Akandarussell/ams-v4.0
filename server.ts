import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'app_database.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// GET /api/database
app.get('/api/database', (req, res) => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return res.json({ success: true, data: parsed, fromDisk: true });
    }
    return res.json({ success: true, data: null, fromDisk: false });
  } catch (err: any) {
    console.error('Error reading database file:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/database
app.post('/api/database', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Write database file
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');

    return res.json({ success: true, message: 'Database saved to server disk successfully' });
  } catch (err: any) {
    console.error('Error writing database file:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/database/backup
app.post('/api/database/backup', (req, res) => {
  try {
    const payload = req.body;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUPS_DIR, `backup-${timestamp}.json`);
    const dataToWrite =
      payload && Object.keys(payload).length > 0
        ? payload
        : fs.existsSync(DB_FILE)
        ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
        : null;

    if (!dataToWrite) {
      return res.status(400).json({ success: false, error: 'No data to backup' });
    }

    fs.writeFileSync(backupFile, JSON.stringify(dataToWrite, null, 2), 'utf-8');
    return res.json({ success: true, filename: `backup-${timestamp}.json` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/database/backups
app.get('/api/database/backups', (req, res) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return res.json({ success: true, backups: [] });
    }
    const files = fs
      .readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, f));
        return {
          filename: f,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ success: true, backups: files });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/database/restore
app.post('/api/database/restore', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Filename is required' });
    }
    const safeFile = path.basename(filename);
    const targetFile = path.join(BACKUPS_DIR, safeFile);
    if (!fs.existsSync(targetFile)) {
      return res.status(404).json({ success: false, error: 'Backup not found' });
    }
    const content = fs.readFileSync(targetFile, 'utf-8');
    fs.writeFileSync(DB_FILE, content, 'utf-8');
    return res.json({ success: true, data: JSON.parse(content) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Google Sheet proxy fetcher (to bypass browser CORS)
app.post('/api/fetch-sheet', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    let fetchUrl = url;
    if (url.includes('docs.google.com/spreadsheets')) {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const id = match[1];
        const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
        const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';
        fetchUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidParam}`;
      }
    }
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch sheet: ${response.statusText}` });
    }
    const text = await response.text();
    return res.json({ success: true, csv: text });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Vite middleware in dev, static files in prod
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
