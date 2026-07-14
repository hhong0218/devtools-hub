(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CsvCleanerCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parseDelimited(text, delimiter) {
    if (typeof text !== 'string') throw new TypeError('Input must be text.');
    if (typeof delimiter !== 'string' || delimiter.length !== 1) throw new Error('Delimiter must be one character.');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    if (text === '') return [];

    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var endedWithNewline = false;

    while (i < text.length) {
      var char = text[i];
      endedWithNewline = false;
      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += char;
        i++;
        continue;
      }

      if (char === '"' && field === '') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === delimiter) {
        row.push(field);
        field = '';
        i++;
        continue;
      }
      if (char === '\r' || char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        endedWithNewline = true;
        if (char === '\r' && text[i + 1] === '\n') i += 2;
        else i++;
        continue;
      }
      field += char;
      i++;
    }

    if (inQuotes) throw new Error('Malformed data: a quoted field is missing its closing quote.');
    if (!endedWithNewline || field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function detectDelimiter(text) {
    var candidates = [',', '\t', ';', '|'];
    var best = { delimiter: ',', score: -1 };
    candidates.forEach(function (delimiter) {
      try {
        var rows = parseDelimited(text, delimiter).filter(function (row) {
          return row.some(function (cell) { return cell.trim() !== ''; });
        }).slice(0, 20);
        if (!rows.length) return;
        var frequencies = Object.create(null);
        rows.forEach(function (row) { frequencies[row.length] = (frequencies[row.length] || 0) + 1; });
        var modeColumns = 1;
        var consistentRows = 0;
        Object.keys(frequencies).forEach(function (key) {
          var count = frequencies[key];
          var columns = Number(key);
          if (columns > 1 && count > consistentRows) {
            modeColumns = columns;
            consistentRows = count;
          }
        });
        var score = consistentRows * modeColumns;
        if (score > best.score) best = { delimiter: delimiter, score: score };
      } catch (error) {
        // Ignore this candidate; another delimiter may parse correctly.
      }
    });
    return best.score > 0 ? best.delimiter : ',';
  }

  function escapeField(value, delimiter) {
    var text = value === null || value === undefined ? '' : String(value);
    if (text.indexOf('"') !== -1 || text.indexOf(delimiter) !== -1 || /[\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function serializeDelimited(rows, delimiter) {
    return rows.map(function (row) {
      return row.map(function (cell) { return escapeField(cell, delimiter); }).join(delimiter);
    }).join('\r\n');
  }

  function cleanRows(sourceRows, options) {
    var settings = Object.assign({
      trimCells: true,
      removeEmptyRows: true,
      removeEmptyColumns: true,
      removeDuplicates: true,
      firstRowHeader: true
    }, options || {});
    var rows = sourceRows.map(function (row) { return row.slice(); });
    var stats = {
      originalRows: rows.length,
      resultRows: 0,
      originalColumns: rows.reduce(function (max, row) { return Math.max(max, row.length); }, 0),
      resultColumns: 0,
      cellsTrimmed: 0,
      emptyRowsRemoved: 0,
      emptyColumnsRemoved: 0,
      duplicateRowsRemoved: 0
    };

    if (settings.trimCells) {
      rows = rows.map(function (row) {
        return row.map(function (cell) {
          var trimmed = String(cell).trim();
          if (trimmed !== String(cell)) stats.cellsTrimmed++;
          return trimmed;
        });
      });
    }

    if (settings.removeEmptyRows) {
      rows = rows.filter(function (row) {
        var empty = row.every(function (cell) { return String(cell).trim() === ''; });
        if (empty) stats.emptyRowsRemoved++;
        return !empty;
      });
    }

    var width = rows.reduce(function (max, row) { return Math.max(max, row.length); }, 0);
    rows.forEach(function (row) {
      while (row.length < width) row.push('');
    });

    if (settings.removeEmptyColumns && rows.length && width) {
      var keepColumns = [];
      for (var column = 0; column < width; column++) {
        var emptyColumn = rows.every(function (row) { return String(row[column] || '').trim() === ''; });
        if (!emptyColumn) keepColumns.push(column);
        else stats.emptyColumnsRemoved++;
      }
      rows = rows.map(function (row) { return keepColumns.map(function (column) { return row[column]; }); });
    }

    if (settings.removeDuplicates && rows.length) {
      var start = settings.firstRowHeader ? 1 : 0;
      var kept = rows.slice(0, start);
      var seen = new Set();
      rows.slice(start).forEach(function (row) {
        var key = JSON.stringify(row);
        if (seen.has(key)) stats.duplicateRowsRemoved++;
        else {
          seen.add(key);
          kept.push(row);
        }
      });
      rows = kept;
    }

    stats.resultRows = rows.length;
    stats.resultColumns = rows.reduce(function (max, row) { return Math.max(max, row.length); }, 0);
    return { rows: rows, stats: stats };
  }

  function cleanDelimited(text, options) {
    if (typeof text !== 'string' || text.trim() === '') throw new Error('Paste or open a CSV/TSV file first.');
    var settings = options || {};
    var inputDelimiter = settings.inputDelimiter && settings.inputDelimiter !== 'auto'
      ? settings.inputDelimiter
      : detectDelimiter(text);
    var outputDelimiter = settings.outputDelimiter && settings.outputDelimiter !== 'same'
      ? settings.outputDelimiter
      : inputDelimiter;
    var parsed = parseDelimited(text, inputDelimiter);
    var cleaned = cleanRows(parsed, settings);
    return {
      inputDelimiter: inputDelimiter,
      outputDelimiter: outputDelimiter,
      rows: cleaned.rows,
      output: serializeDelimited(cleaned.rows, outputDelimiter),
      stats: cleaned.stats
    };
  }

  return {
    parseDelimited: parseDelimited,
    detectDelimiter: detectDelimiter,
    serializeDelimited: serializeDelimited,
    cleanRows: cleanRows,
    cleanDelimited: cleanDelimited
  };
});
