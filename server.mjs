import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');
const server=http.createServer((req,res)=>{const previewPrefix=process.env.PREVIEW_BASE_PATH||'';if(previewPrefix&&req.url.startsWith(previewPrefix+'/'))req.url=req.url.slice(previewPrefix.length);const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'})[path.extname(p)]||'application/octet-stream');res.end(data);});});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
