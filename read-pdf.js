import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

const buf = new Uint8Array(fs.readFileSync('c:\\Users\\PC\\Downloads\\facebook-asd-co-ban.pdf'));
const doc = await pdfjsLib.getDocument({ data: buf }).promise;
console.log('PAGES:', doc.numPages);
console.log('---TEXT START---');
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  const text = content.items.map(item => item.str).join(' ');
  console.log(`\n--- PAGE ${i} ---\n`);
  console.log(text);
}
console.log('\n---TEXT END---');
