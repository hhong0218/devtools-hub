'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const measurementId = 'G-6LMBTP1QJY';
const legacyMeasurementId = 'G-9QKMV5JQL5';
const linkedDomains = [
  'quietools.com',
  'calc.quietools.com',
  'image.quietools.com',
  'dev.quietools.com',
  'typing.quietools.com',
  'invoice.quietools.com',
  '3d.quietools.com',
  'visa.quietools.com'
];

function collectHtmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git') return [];
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectHtmlFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith('.html') ? [absolutePath] : [];
  });
}

const files = collectHtmlFiles(root);
assert.ok(files.length > 0, 'Expected at least one HTML page.');

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(root, file);

  assert.ok(
    html.includes(`googletagmanager.com/gtag/js?id=${measurementId}`),
    `${relativePath} must load the Quietools Network tag.`
  );
  assert.match(
    html,
    new RegExp(`gtag\\(\\s*['\"]config['\"]\\s*,\\s*['\"]${measurementId}['\"]`),
    `${relativePath} must configure the Quietools Network property.`
  );
  assert.ok(
    !html.includes(legacyMeasurementId),
    `${relativePath} still contains the legacy mixed-property ID.`
  );

  for (const domain of linkedDomains) {
    assert.ok(html.includes(`'${domain}'`), `${relativePath} must link ${domain}.`);
  }
}

console.log(`Analytics config tests passed for ${files.length} HTML pages.`);
