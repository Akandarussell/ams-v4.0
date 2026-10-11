import type { IncomingMessage, ServerResponse } from 'http';
import databaseData from '../data/app_database.json';

export default function handler(
  req: IncomingMessage & { method?: string; body?: any },
  res: ServerResponse
) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, data: databaseData, fromDisk: true }));
    return;
  }

  if (req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, message: 'Saved to session' }));
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
