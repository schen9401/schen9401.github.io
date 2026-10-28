import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8',
};

function isWithin(directory, path) {
  const rel = relative(directory, path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

export function createPreviewServer(directory = root) {
  const base = resolve(directory);
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }

    let path;
    let url;
    try {
      url = new URL(request.url, 'http://localhost');
      path = decodeURIComponent(url.pathname);
    } catch (error) {
      if (!(error instanceof URIError || error instanceof TypeError)) throw error;
      response.writeHead(400).end('Invalid URL');
      return;
    }

    if (path.includes('\0') || path.split(/[\\/]/).some((part) => part.startsWith('.'))) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    let file = resolve(base, `.${path}`);
    if (!isWithin(base, file)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const info = await stat(file);
      if (info.isDirectory()) {
        if (!url.pathname.endsWith('/')) {
          response.writeHead(308, { Location: `${url.pathname.replace(/^\/+/, '/')}/${url.search}` }).end();
          return;
        }
        file = resolve(file, 'index.html');
      }
      file = await realpath(file);
      if (!isWithin(await realpath(base), file)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const fileInfo = await stat(file);
      if (!fileInfo.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      if (!types[extname(file)]) {
        response.writeHead(403).end('File type not served');
        return;
      }
      const headers = {
        'Content-Type': types[extname(file)],
        'Content-Length': fileInfo.size,
        'Cache-Control': 'no-cache',
        'Accept-Ranges': 'bytes',
      };
      let start = 0;
      let end = fileInfo.size - 1;
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        const first = range?.[1] ? Number(range[1]) : null;
        const last = range?.[2] ? Number(range[2]) : null;
        const valid = range && (first !== null || last !== null) &&
          (first === null || Number.isSafeInteger(first)) &&
          (last === null || Number.isSafeInteger(last));
        if (valid) {
          start = first ?? Math.max(0, fileInfo.size - last);
          end = first === null ? fileInfo.size - 1 : Math.min(last ?? end, end);
        }
        if (!valid || start >= fileInfo.size || start > end || (first === null && last === 0)) {
          response.writeHead(416, { 'Content-Range': `bytes */${fileInfo.size}` }).end();
          return;
        }
        headers['Content-Range'] = `bytes ${start}-${end}/${fileInfo.size}`;
        headers['Content-Length'] = end - start + 1;
      }
      response.writeHead(request.headers.range ? 206 : 200, headers);
      if (request.method === 'HEAD') response.end();
      else {
        const stream = createReadStream(file, request.headers.range ? { start, end } : undefined);
        stream.on('error', (error) => {
          console.error('Preview file stream failed:', error);
          response.destroy(error);
        });
        stream.pipe(response);
      }
    } catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes(error.code)) response.writeHead(404).end('Not found');
      else {
        console.error('Preview request failed:', error);
        response.writeHead(500).end('Preview request failed');
      }
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
  const server = createPreviewServer();
  server.on('error', (error) => {
    console.error('Unable to start the local portfolio preview:', error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`Portfolio preview: http://127.0.0.1:${server.address().port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
