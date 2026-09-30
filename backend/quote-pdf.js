/* ──────────────────────────────────────────────────────────────────
   Quote PDF (server-side, pdfkit) — same layout as the HTML quote.
   buildQuotePdf(row) → Promise<Buffer>
   ────────────────────────────────────────────────────────────────── */
const PDFDocument = require('pdfkit');

const GREEN = '#a3c24d', BLACK = '#111111', TEXT = '#333333', MUTED = '#777777', BORDER = '#E8E8E6', ZEBRA = '#FAFAF8';

const fmtR = n => 'R' + Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtDate = iso => {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${parseInt(d, 10)} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m, 10) - 1]} ${y}`;
};

// Company + address lines, without repeating the contact or company name
function toLines(r) {
  const n = x => String(x || '').trim().toLowerCase();
  const seen = new Set([n(r.contact_person)]), out = [];
  [r.company_name, ...String(r.client_address || '').split('\n')].forEach(l => {
    if (n(l) && !seen.has(n(l))) { seen.add(n(l)); out.push(String(l).trim()); }
  });
  return [...out, r.client_phone, r.client_email, r.website_url].filter(Boolean);
}

function quoteFilename(row) {
  return `${String(row.quote_number || `Quote_${row.id}`).replace(/[^a-z0-9_\-]+/gi, '_')}.pdf`;
}

function buildQuotePdf(row) {
  return new Promise((resolve, reject) => {
    const items = Array.isArray(row.line_items) ? row.line_items : JSON.parse(row.line_items || '[]');
    const dep   = Number(row.deposit_pct || 60);
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true,
      info: { Title: `Quotation ${row.quote_number || ''}`, Author: 'KliekNet' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width, M = 50, CW = W - M * 2;
    const BOTTOM = doc.page.height - 46;   // footer band starts at height-34
    let y;
    const ensure = h => { if (y + h > BOTTOM) { doc.addPage(); y = 60; return true; } return false; };

    // ── Header band
    doc.rect(0, 0, W, 104).fill(BLACK);
    doc.circle(M + 21, 52, 21).fill(GREEN);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(19).text('K', M + 14, 42);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14).text('KLIEKNET', M + 54, 40, { characterSpacing: 1.4 });
    doc.fillColor('#888888').font('Helvetica').fontSize(7).text('AI-DRIVEN SOLUTIONS', M + 54, 58, { characterSpacing: 1.2 });
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('QUOTATION', M, 26, { width: CW, align: 'right', characterSpacing: 1.2 });
    doc.fillColor('#AAAAAA').font('Helvetica').fontSize(9).text(row.quote_number || '', M, 54, { width: CW, align: 'right' });
    doc.text(`Issued: ${fmtDate(row.date_issued)}   ·   Valid until: ${fmtDate(row.valid_until)}`, M, 67, { width: CW, align: 'right' });
    if (row.prepared_by) doc.fillColor('#BBBBBB').fontSize(8).text(`Prepared by: ${row.prepared_by}`, M, 80, { width: CW, align: 'right' });
    doc.rect(0, 104, W, 3).fill(GREEN);

    // ── From / To
    y = 132;
    const colW = (CW - 40) / 2;
    const block = (x, title, name, lines) => {
      doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.5).text(title, x, y, { characterSpacing: 1.6 });
      doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(10).text(name, x, y + 16, { width: colW });
      doc.fillColor(TEXT).font('Helvetica').fontSize(9.5).text(lines.join('\n'), x, doc.y + 2, { width: colW, lineGap: 3 });
      return doc.y;
    };
    const yFrom = block(M, 'FROM', 'Klieknet Web Development',
      ['Stellenbosch Central, South Africa', '+27 (0)84 9000 193', 'gustav@klieknet.com', 'www.klieknet.com']);
    const yTo = block(M + colW + 40, 'TO', row.contact_person || row.company_name || '—',
      toLines(row.contact_person ? row : { ...row, company_name: '' }));
    y = Math.max(yFrom, yTo) + 18;

    // ── Scope / notes
    const panel = (label, text) => {
      doc.font('Helvetica').fontSize(9.5);
      const h = doc.heightOfString(text, { width: CW - 30, lineGap: 2 }) + 34;
      ensure(h);
      doc.rect(M, y, CW, h).fill('#F8F8F6');
      doc.rect(M, y, 3, h).fill(GREEN);
      doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.5).text(label, M + 16, y + 11, { characterSpacing: 1.6 });
      doc.fillColor('#444444').font('Helvetica').fontSize(9.5).text(text, M + 16, y + 24, { width: CW - 30, lineGap: 2 });
      y += h + 14;
    };
    if (row.job_summary)      panel('SCOPE OF WORK', row.job_summary);
    if (row.additional_notes) panel('ADDITIONAL NOTES', row.additional_notes);

    // ── Line items
    const cols = [{ w: CW - 250, a: 'left', t: 'Description' }, { w: 70, a: 'center', t: 'Qty / Hrs' },
                  { w: 90, a: 'right', t: 'Unit Price' }, { w: 90, a: 'right', t: 'Total' }];
    const tableHead = () => {
      doc.rect(M, y, CW, 24).fill(BLACK);
      let x = M;
      cols.forEach(c => { doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5).text(c.t, x + 10, y + 8, { width: c.w - 20, align: c.a }); x += c.w; });
      y += 24;
    };
    ensure(60);
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.5).text('LINE ITEMS', M, y, { characterSpacing: 1.6 });
    y += 16;
    tableHead();
    items.forEach((it, i) => {
      const vals = [it.desc || '', String(it.qty ?? ''), fmtR(it.rate), fmtR(it.total ?? (it.qty * it.rate))];
      doc.font('Helvetica').fontSize(9.5);
      const h = Math.max(doc.heightOfString(vals[0], { width: cols[0].w - 20 }), 11) + 12;
      if (ensure(h)) tableHead();
      if (i % 2) doc.rect(M, y, CW, h).fill(ZEBRA);
      let x = M;
      vals.forEach((v, k) => {
        doc.fillColor(k >= 2 ? BLACK : TEXT).font(k >= 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5)
           .text(v, x + 10, y + 6, { width: cols[k].w - 20, align: cols[k].a });
        x += cols[k].w;
      });
      doc.moveTo(M, y + h).lineTo(M + CW, y + h).lineWidth(0.5).strokeColor(BORDER).stroke();
      y += h;
    });

    // ── Totals
    y += 16;
    ensure(90);
    const tx = M + CW - 230, tw = 230;
    doc.moveTo(tx, y).lineTo(tx + tw, y).lineWidth(1.5).strokeColor(BLACK).stroke();
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(11.5).text('Grand Total', tx, y + 9);
    doc.text(fmtR(row.grand_total), tx, y + 9, { width: tw, align: 'right' });
    y += 27;
    doc.moveTo(tx, y).lineTo(tx + tw, y).lineWidth(1.5).strokeColor(BLACK).stroke();
    y += 8;
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(10).text(`Deposit (${dep}%)`, tx, y);
    doc.text(fmtR(row.deposit_amount), tx, y, { width: tw, align: 'right' });
    y += 20;
    doc.fillColor('#555555').text(`Balance (${100 - dep}%)`, tx, y);
    doc.text(fmtR(row.balance_amount), tx, y, { width: tw, align: 'right' });
    y += 24;

    // ── Terms
    const terms = [
      `A deposit of ${dep}% of the total quoted amount is due on the day of acceptance. Upon completion Klieknet will invoice for the balance. The site will not go live until all payments have been received.`,
      'The client is responsible for ALL content (text, images, etc.) required for development, supplied in digital format.',
      'Once accepted, the client has two weeks to supply all content, unless otherwise agreed in writing.',
      'If the completed site is handed over for review and the client does not supply corrections within 15 working days, Klieknet will invoice for the full balance.',
    ];
    ensure(150);
    doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    y += 14;
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.5).text('TERMS & CONDITIONS', M, y, { characterSpacing: 1.6 });
    y += 16;
    terms.forEach((t, i) => {
      doc.font('Helvetica').fontSize(9);
      const h = doc.heightOfString(t, { width: CW - 18, lineGap: 2 }) + 6;
      ensure(h);
      doc.fillColor('#555555').text(`${i + 1}.`, M, y).text(t, M + 18, y, { width: CW - 18, lineGap: 2 });
      y += h;
    });
    doc.fillColor('#999999').font('Helvetica-Oblique').fontSize(8.5).text('This quotation is valid for four weeks from the date of issue.', M, y + 4);
    y += 22;

    // ── Agreement
    ensure(72);
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.5).text('AGREEMENT', M, y, { characterSpacing: 1.6 });
    doc.fillColor(TEXT).font('Helvetica').fontSize(10).text('I accept the quotation and hereby give permission to start with the job.', M, y + 16);
    y += 44;
    const sw = (CW - 60) / 2;
    doc.moveTo(M, y).lineTo(M + sw, y).lineWidth(0.8).strokeColor('#AAAAAA').stroke();
    doc.moveTo(M + sw + 60, y).lineTo(M + CW, y).stroke();
    doc.fillColor('#999999').font('Helvetica').fontSize(8.5)
       .text(`Representative of ${row.company_name || '____________________'}`, M, y + 6, { width: sw })
       .text('Date', M + sw + 60, y + 6, { width: sw });

    // ── Footer on every page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bm = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.rect(0, doc.page.height - 34, W, 34).fill(BLACK);
      doc.fillColor('#888888').font('Helvetica').fontSize(8).text(
        'Stellenbosch  |  +27 (0)84 9000 193  |  info@klieknet.com  |  www.klieknet.com',
        M, doc.page.height - 21, { width: CW, align: 'center', lineBreak: false });
      doc.page.margins.bottom = bm;
    }
    doc.end();
  });
}

module.exports = { buildQuotePdf, quoteFilename };
