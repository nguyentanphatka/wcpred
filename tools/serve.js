'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIME = {
    html: 'text/html', js: 'application/javascript',
    json: 'application/json', css: 'text/css', png: 'image/png', svg: 'image/svg+xml'
};

http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    const fp = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); return res.end('404');
    }
    const ext = fp.split('.').pop();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(fs.readFileSync(fp));
}).listen(7890, () => console.log('Dev server: http://localhost:7890'));
