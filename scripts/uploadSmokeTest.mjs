import fs from 'node:fs/promises';

const buf = await fs.readFile(new URL('../package.json', import.meta.url));
const form = new FormData();
form.append('files', new Blob([buf], { type: 'application/json' }), 'package.json');

const res = await fetch('http://127.0.0.1:5173/api/v1/media/upload', {
  method: 'POST',
  headers: { 'x-admin-passcode': 'heritage-admin' },
  body: form,
});

const text = await res.text();
console.log(text);
process.exit(res.ok ? 0 : 1);

