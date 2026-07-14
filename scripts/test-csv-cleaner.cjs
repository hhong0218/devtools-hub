'use strict';

const assert = require('node:assert/strict');
const cleaner = require('../assets/csv-cleaner-core.js');

const quoted = cleaner.parseDelimited('name,note\r\nAda,"comma, quote ""and"" newline\nkept"', ',');
assert.deepEqual(quoted, [
  ['name', 'note'],
  ['Ada', 'comma, quote "and" newline\nkept']
]);

assert.equal(cleaner.detectDelimiter('name\trole\nAda\tEngineer'), '\t');
assert.equal(cleaner.detectDelimiter('name;role\nAda;Engineer'), ';');

const result = cleaner.cleanDelimited(
  'name,email,unused\n Ada , ada@example.com ,\n,,\nAda,ada@example.com,\n Bob , bob@example.com ,',
  {
    inputDelimiter: ',',
    outputDelimiter: ',',
    trimCells: true,
    removeEmptyRows: true,
    removeEmptyColumns: true,
    removeDuplicates: true,
    firstRowHeader: true
  }
);

assert.deepEqual(result.rows, [
  ['name', 'email', 'unused'],
  ['Ada', 'ada@example.com', ''],
  ['Bob', 'bob@example.com', '']
]);
assert.equal(result.stats.cellsTrimmed, 4);
assert.equal(result.stats.emptyRowsRemoved, 1);
assert.equal(result.stats.duplicateRowsRemoved, 1);
assert.equal(result.stats.emptyColumnsRemoved, 0, 'A named header keeps its column even when data cells are empty.');

const emptyColumn = cleaner.cleanRows([
  ['name', '', 'role'],
  ['Ada', '', 'Engineer']
], { removeEmptyColumns: true, removeDuplicates: false });
assert.deepEqual(emptyColumn.rows, [['name', 'role'], ['Ada', 'Engineer']]);
assert.equal(emptyColumn.stats.emptyColumnsRemoved, 1);

assert.equal(
  cleaner.serializeDelimited([['name', 'note'], ['Ada', 'line 1\nline 2'], ['Linus', 'a "quote"']], ','),
  'name,note\r\nAda,"line 1\nline 2"\r\nLinus,"a ""quote"""'
);

assert.throws(() => cleaner.parseDelimited('name,note\nAda,"open', ','), /closing quote/);
assert.throws(() => cleaner.cleanDelimited('   '), /Paste or open/);

console.log('CSV cleaner tests passed: parser, delimiter detection, cleanup stats, serialization, and errors.');
