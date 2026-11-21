// A fast drop-in for csv-reader 1.0.0: readCsv's answer for one CSV input,
// {columns, rows, errors}, byte for byte the same as the reference,
// including its broken-row policy: a stray CR outside quotes, junk after
// a closing quote, a quote that never closes, and short or long rows.
//
// The reference walks the text one character at a time and grows every
// field a character at a time. This reader instead finds each field's end
// with indexOf and cuts the field out whole, so a plain field costs two
// searches and one slice. A record whose line holds no quote at all is
// split in one go. Only the rare broken bits take a slower path: a stray
// CR, junk after a quote, a quote that never closes. The cases the
// generator draws hold about one broken record in forty, so the slow
// paths barely matter.
//
// The reader is pure: no clock, no randomness, nothing kept from one
// call to the next. It answers the same input the same way every time.

/** How many lines the breaks inside a quoted field's content stand for:
 * each CR counts once, each LF counts once unless a CR stands right
 * before it (a CRLF is one break, not two). */
function countBreaks(content) {
  let breaks = 0;
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i);
    if (c === 13) breaks++;
    else if (c === 10 && content.charCodeAt(i - 1) !== 13) breaks++;
  }
  return breaks;
}

/** The fields of a physical line that holds no quote but does hold a
 * stray CR: the line is split on commas, every CR dropped, one stray_cr
 * error for each CR dropped, in the order they are met. `crlf` says the
 * line's last CR is its line break, not a stray one. */
function strayLine(line, crlf, recordLine, recordRow, errors) {
  const body = crlf ? line.slice(0, -1) : line;
  const fields = body.split(',');
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field.indexOf('\r') === -1) continue;
    const pieces = field.split('\r');
    for (let k = 1; k < pieces.length; k++) {
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
    }
    fields[i] = pieces.join('');
  }
  return fields;
}

/** csv-reader 1.0.0's answer for one case's input, {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xFEFF) pos = 1; // a U+FEFF at the very start is dropped

  while (true) {
    // Lines left with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    // The record being read: the line it starts on and the index in
    // rows it takes (null: the header).
    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;

    let fields;
    let lastQuoted = false;

    // The record's first physical line: a record with no quote in it
    // ends at that line's break, so it can be split in one go.
    const lineEnd = text.indexOf('\n', pos);
    const end = lineEnd === -1 ? n : lineEnd;
    const quoteAt = text.indexOf('"', pos);
    if (quoteAt === -1 || quoteAt >= end) {
      const seg = text.slice(pos, end);
      const crAt = seg.indexOf('\r');
      if (crAt === -1) {
        fields = seg.split(',');
      } else if (crAt === seg.length - 1 && end < n) {
        // The only CR is the line break's own (CRLF).
        fields = seg.slice(0, -1).split(',');
      } else {
        fields = strayLine(seg, end < n && seg.charCodeAt(seg.length - 1) === 13, recordLine, recordRow, errors);
      }
      pos = end < n ? end + 1 : n;
      if (end < n) line += 1;
    } else {
      // The record holds a quote: read it field by field.
      fields = [];
      let recordDone = false;
      while (!recordDone) {
        let value;
        let quoted = false;
        let junk = false;
        if (text.charCodeAt(pos) === 34) {
          quoted = true;
          const open = pos;
          // The closing quote is the next quote that is not doubled.
          let q = open + 1;
          let close = -1;
          for (;;) {
            const cand = text.indexOf('"', q);
            if (cand === -1) break;
            if (text.charCodeAt(cand + 1) === 34) {
              q = cand + 2;
              continue;
            }
            close = cand;
            break;
          }
          if (close === -1) {
            // The quote never closes: it is a literal character, and
            // the text after it is read again as unquoted.
            errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
            value = '"';
            pos = open + 1;
          } else {
            let quotedValue = text.slice(open + 1, close);
            if (quotedValue.indexOf('\n') !== -1 || quotedValue.indexOf('\r') !== -1) {
              line += countBreaks(quotedValue);
              // Each CRLF or lone CR inside quotes is read as one LF.
              quotedValue = quotedValue.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
            }
            if (quotedValue.indexOf('""') !== -1) quotedValue = quotedValue.replaceAll('""', '"');
            const next = close + 1;
            if (next >= n) {
              fields.push(quotedValue);
              lastQuoted = true;
              pos = n;
              recordDone = true;
              break;
            }
            const nc = text.charCodeAt(next);
            if (nc === 44) {
              fields.push(quotedValue);
              lastQuoted = true;
              pos = next + 1;
              continue;
            }
            if (nc === 10) {
              fields.push(quotedValue);
              lastQuoted = true;
              pos = next + 1;
              line += 1;
              recordDone = true;
              break;
            }
            if (nc === 13 && text.charCodeAt(next + 1) === 10) {
              fields.push(quotedValue);
              lastQuoted = true;
              pos = next + 2;
              line += 1;
              recordDone = true;
              break;
            }
            // What follows the closing quote is appended as it stands,
            // up to the next comma or line break: read it as unquoted.
            value = quotedValue;
            junk = true;
            pos = next;
          }
        } else {
          value = '';
        }

        // Read unquoted characters onto `value` up to the next comma or
        // line break. The field is the stretch to the nearer of the two;
        // a CR inside it is dropped (stray_cr), unless it is the line
        // break's own at the stretch's end (CRLF).
        let ended; // 0: comma, 1: line break, 2: end of text
        let added = 0; // characters this scan appends
        {
          const comma = text.indexOf(',', pos);
          const lf = text.indexOf('\n', pos);
          let stop;
          if (comma !== -1 && (lf === -1 || comma < lf)) {
            stop = comma;
            ended = 0;
          } else if (lf !== -1) {
            stop = lf;
            ended = 1;
          } else {
            stop = n;
            ended = 2;
          }
          let seg = text.slice(pos, stop);
          if (ended === 1 && seg.charCodeAt(seg.length - 1) === 13) {
            seg = seg.slice(0, -1); // the CR is the line break's own (CRLF)
          }
          const cr = seg.indexOf('\r');
          if (cr !== -1) {
            const pieces = seg.split('\r');
            for (let k = 1; k < pieces.length; k++) {
              errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            }
            seg = pieces.join('');
          }
          value = value === '' ? seg : value + seg;
          added = seg.length;
          if (ended === 1) line += 1;
          pos = ended === 2 ? n : stop + 1;
        }
        if (junk && added > 0) {
          errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        }
        fields.push(value);
        lastQuoted = quoted;
        if (ended !== 0) recordDone = true;
      }
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
