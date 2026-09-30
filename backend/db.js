const Database = require('better-sqlite3');
const path     = require('path');

const fs       = require('fs');
const DATA_DIR = process.env.DATA_DIR || __dirname;   // on the server: a persistent disk
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'klieknet.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS quotes (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number     TEXT    NOT NULL DEFAULT '',
    date_issued      TEXT,
    valid_until      TEXT,
    contact_person   TEXT    NOT NULL DEFAULT '',
    company_name     TEXT    NOT NULL DEFAULT '',
    client_email     TEXT    NOT NULL DEFAULT '',
    client_phone     TEXT    NOT NULL DEFAULT '',
    client_address   TEXT    NOT NULL DEFAULT '',
    website_url      TEXT    NOT NULL DEFAULT '',
    job_summary      TEXT    NOT NULL DEFAULT '',
    additional_notes TEXT    NOT NULL DEFAULT '',
    prepared_by      TEXT    NOT NULL DEFAULT '',
    quote_name       TEXT    NOT NULL DEFAULT '',
    access_token     TEXT,
    line_items       TEXT    NOT NULL DEFAULT '[]',
    deposit_pct      REAL    NOT NULL DEFAULT 60,
    subtotal         REAL    NOT NULL DEFAULT 0,
    grand_total      REAL    NOT NULL DEFAULT 0,
    deposit_amount   REAL    NOT NULL DEFAULT 0,
    balance_amount   REAL    NOT NULL DEFAULT 0,
    status           TEXT    NOT NULL DEFAULT 'draft'
                             CHECK(status IN ('draft','sent','approved','invoiced','rejected')),
    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT    NOT NULL UNIQUE,
    name            TEXT    NOT NULL DEFAULT '',
    contactCount    INTEGER NOT NULL DEFAULT 0,
    segment         TEXT    NOT NULL DEFAULT 'untagged'
                            CHECK(segment IN ('client','prospect','partner','vendor','untagged')),
    notes           TEXT    NOT NULL DEFAULT '',
    lastInteraction TEXT,
    approved        INTEGER NOT NULL DEFAULT 1,
    directMarketing INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_quotes_status   ON quotes(status);
  CREATE INDEX IF NOT EXISTS idx_contacts_email   ON contacts(email);
  CREATE INDEX IF NOT EXISTS idx_contacts_segment ON contacts(segment);
`);

// Migrate existing DB — safe to run every startup
try { db.exec(`ALTER TABLE contacts ADD COLUMN approved INTEGER NOT NULL DEFAULT 1`); } catch (_) {}
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_contacts_approved ON contacts(approved)`); } catch (_) {}
db.exec(`UPDATE contacts SET approved = 1 WHERE approved = 0`);
try { db.exec(`ALTER TABLE contacts ADD COLUMN directMarketing INTEGER NOT NULL DEFAULT 0`); } catch (_) {}

// Quotes schema migrations (for existing DBs with old schema)
const quoteMigrations = [
  `ALTER TABLE quotes ADD COLUMN quote_number TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN date_issued TEXT`,
  `ALTER TABLE quotes ADD COLUMN valid_until TEXT`,
  `ALTER TABLE quotes ADD COLUMN contact_person TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN company_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN client_email TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN client_phone TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN client_address TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN website_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN job_summary TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN additional_notes TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN prepared_by TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN quote_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN access_token TEXT`,
  `ALTER TABLE quotes ADD COLUMN line_items TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE quotes ADD COLUMN deposit_pct REAL NOT NULL DEFAULT 60`,
  `ALTER TABLE quotes ADD COLUMN subtotal REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE quotes ADD COLUMN grand_total REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE quotes ADD COLUMN deposit_amount REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE quotes ADD COLUMN balance_amount REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE quotes ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`,
  // Legacy columns: old DBs have these as NOT NULL, fresh DBs need them so INSERT works everywhere
  `ALTER TABLE quotes ADD COLUMN clientName TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN clientEmail TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE quotes ADD COLUMN items TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE quotes ADD COLUMN totalPrice REAL NOT NULL DEFAULT 0`,
];
for (const sql of quoteMigrations) { try { db.exec(sql); } catch (_) {} }

// Backfill blank timestamps (columns added via ALTER got '' as default)
try { db.exec(`UPDATE quotes SET created_at = createdAt WHERE created_at = '' AND createdAt IS NOT NULL AND createdAt != ''`); } catch (_) {}
db.exec(`UPDATE quotes SET created_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE created_at = '' OR created_at IS NULL`);
db.exec(`UPDATE quotes SET updated_at = created_at WHERE updated_at = '' OR updated_at IS NULL`);

// Data migration: copy old-schema columns to new columns
try {
  db.exec(`
    UPDATE quotes SET
      company_name = CASE WHEN company_name = '' AND clientName != '' THEN clientName ELSE company_name END,
      client_email = CASE WHEN client_email = '' AND clientEmail != '' THEN clientEmail ELSE client_email END,
      grand_total  = CASE WHEN grand_total = 0 AND totalPrice > 0 THEN totalPrice ELSE grand_total END,
      subtotal     = CASE WHEN subtotal = 0 AND totalPrice > 0 THEN totalPrice ELSE subtotal END,
      line_items   = CASE WHEN line_items = '[]' AND items IS NOT NULL AND items != '' AND items != '[]' THEN items ELSE line_items END
    WHERE (clientName != '' OR clientEmail != '' OR totalPrice > 0)
  `);
} catch (_) {}

// Proposals table
db.exec(`
  CREATE TABLE IF NOT EXISTS proposals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL DEFAULT '',
    client_name  TEXT    NOT NULL DEFAULT '',
    client_email TEXT    NOT NULL DEFAULT '',
    filename     TEXT    NOT NULL,
    filepath     TEXT    NOT NULL,
    access_code  TEXT    NOT NULL UNIQUE,
    status       TEXT    NOT NULL DEFAULT 'active'
                         CHECK(status IN ('active','archived')),
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_proposals_code ON proposals(access_code);
  CREATE INDEX IF NOT EXISTS idx_proposals_email ON proposals(client_email);
`);

// ── Quotes ────────────────────────────────────────────────────────
const quotes = {
  all: db.prepare(`
    SELECT * FROM quotes ORDER BY created_at DESC, id DESC
  `),

  byId: db.prepare(`
    SELECT * FROM quotes WHERE id = ?
  `),

  byStatus: db.prepare(`
    SELECT * FROM quotes WHERE status = ? ORDER BY created_at DESC, id DESC
  `),

  insert: db.prepare(`
    INSERT INTO quotes (
      clientName, clientEmail,
      quote_number, date_issued, valid_until,
      contact_person, company_name, client_email, client_phone, client_address, website_url,
      job_summary, additional_notes, prepared_by, quote_name, line_items,
      deposit_pct, subtotal, grand_total, deposit_amount, balance_amount, status,
      created_at, updated_at
    ) VALUES (
      '', '',
      @quote_number, @date_issued, @valid_until,
      @contact_person, @company_name, @client_email, @client_phone, @client_address, @website_url,
      @job_summary, @additional_notes, @prepared_by, @quote_name, @line_items,
      @deposit_pct, @subtotal, @grand_total, @deposit_amount, @balance_amount, @status,
      strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now')
    )
  `),

  update: db.prepare(`
    UPDATE quotes SET
      quote_number     = @quote_number,
      date_issued      = @date_issued,
      valid_until      = @valid_until,
      contact_person   = @contact_person,
      company_name     = @company_name,
      client_email     = @client_email,
      client_phone     = @client_phone,
      client_address   = @client_address,
      website_url      = @website_url,
      job_summary      = @job_summary,
      additional_notes = @additional_notes,
      prepared_by      = @prepared_by,
      quote_name       = @quote_name,
      line_items       = @line_items,
      deposit_pct      = @deposit_pct,
      subtotal         = @subtotal,
      grand_total      = @grand_total,
      deposit_amount   = @deposit_amount,
      balance_amount   = @balance_amount,
      status           = @status,
      updated_at       = strftime('%Y-%m-%dT%H:%M:%SZ','now')
    WHERE id = @id
  `),

  publish: db.prepare(`
    UPDATE quotes SET
      status       = 'sent',
      access_token = @access_token,
      updated_at   = strftime('%Y-%m-%dT%H:%M:%SZ','now')
    WHERE id = @id
  `),

  byToken: db.prepare(`SELECT * FROM quotes WHERE access_token = ?`),

  updateStatus: db.prepare(`
    UPDATE quotes
    SET status     = @status,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
    WHERE id = @id
  `),

  delete: db.prepare(`
    DELETE FROM quotes WHERE id = ?
  `),
};

// ── Proposals ─────────────────────────────────────────────────────
const proposals = {
  all: db.prepare(`SELECT * FROM proposals ORDER BY created_at DESC`),
  byId: db.prepare(`SELECT * FROM proposals WHERE id = ?`),
  byCode: db.prepare(`SELECT * FROM proposals WHERE access_code = ?`),
  insert: db.prepare(`
    INSERT INTO proposals (title, client_name, client_email, filename, filepath, access_code, status)
    VALUES (@title, @client_name, @client_email, @filename, @filepath, @access_code, @status)
  `),
  delete: db.prepare(`DELETE FROM proposals WHERE id = ?`),
};

// ── Contacts ──────────────────────────────────────────────────────
const contacts = {
  all: db.prepare(`
    SELECT * FROM contacts ORDER BY contactCount DESC
  `),

  byId: db.prepare(`
    SELECT * FROM contacts WHERE id = ?
  `),

  byEmail: db.prepare(`
    SELECT * FROM contacts WHERE email = ?
  `),

  bySegment: db.prepare(`
    SELECT * FROM contacts WHERE segment = ? ORDER BY contactCount DESC
  `),

  search: db.prepare(`
    SELECT * FROM contacts
    WHERE email LIKE @q OR name LIKE @q
    ORDER BY contactCount DESC
    LIMIT 50
  `),

  insert: db.prepare(`
    INSERT INTO contacts (email, name, contactCount, segment, notes, lastInteraction)
    VALUES (@email, @name, @contactCount, @segment, @notes, @lastInteraction)
  `),

  update: db.prepare(`
    UPDATE contacts
    SET name            = @name,
        contactCount    = @contactCount,
        segment         = @segment,
        notes           = @notes,
        lastInteraction = @lastInteraction,
        approved        = @approved,
        directMarketing = @directMarketing
    WHERE id = @id
  `),

  // Upsert used when importing from the mail scan
  upsert: db.prepare(`
    INSERT INTO contacts (email, name, contactCount, lastInteraction)
    VALUES (@email, @name, @contactCount, @lastInteraction)
    ON CONFLICT(email) DO UPDATE SET
      name            = CASE WHEN excluded.name != '' THEN excluded.name ELSE contacts.name END,
      contactCount    = excluded.contactCount,
      lastInteraction = excluded.lastInteraction
  `),

  // Used by the unsubscribe endpoint — inserts as unapproved if not yet in DB
  unsubscribe: db.prepare(`
    INSERT INTO contacts (email, approved) VALUES (?, 0)
    ON CONFLICT(email) DO UPDATE SET approved = 0
  `),

  delete: db.prepare(`
    DELETE FROM contacts WHERE id = ?
  `),
};

// Bulk upsert wrapped in a transaction for speed
const bulkUpsertContacts = db.transaction((rows) => {
  for (const row of rows) contacts.upsert.run(row);
});


// ── Projects ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL DEFAULT '',
    quote_id       INTEGER REFERENCES quotes(id) ON DELETE SET NULL,
    contact_person TEXT    NOT NULL DEFAULT '',
    company_name   TEXT    NOT NULL DEFAULT '',
    client_email   TEXT    NOT NULL DEFAULT '',
    status         TEXT    NOT NULL DEFAULT 'planned'
                           CHECK(status IN ('planned','in_progress','on_hold','review','completed','cancelled')),
    progress       INTEGER NOT NULL DEFAULT 0,
    value          REAL    NOT NULL DEFAULT 0,
    start_date     TEXT,
    due_date       TEXT,
    website_url    TEXT    NOT NULL DEFAULT '',
    notes          TEXT    NOT NULL DEFAULT '',
    created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
`);

const PROJECT_FIELDS = ['name','quote_id','contact_person','company_name','client_email','status',
  'progress','value','start_date','due_date','website_url','notes'];

const projects = {
  all:    db.prepare(`SELECT p.*, q.quote_number FROM projects p LEFT JOIN quotes q ON q.id = p.quote_id
                      ORDER BY CASE p.status WHEN 'completed' THEN 2 WHEN 'cancelled' THEN 3 ELSE 1 END,
                               COALESCE(p.due_date,'9999'), p.id DESC`),
  byId:   db.prepare(`SELECT p.*, q.quote_number FROM projects p LEFT JOIN quotes q ON q.id = p.quote_id WHERE p.id = ?`),
  insert: db.prepare(`INSERT INTO projects (${PROJECT_FIELDS.join(',')})
                      VALUES (${PROJECT_FIELDS.map(f => '@' + f).join(',')})`),
  update: db.prepare(`UPDATE projects SET ${PROJECT_FIELDS.map(f => `${f} = @${f}`).join(', ')},
                      updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = @id`),
  delete: db.prepare(`DELETE FROM projects WHERE id = ?`),
  FIELDS: PROJECT_FIELDS,
};


// ── Mandates (debit order mandates: uploaded files + online form submissions) ─
db.exec(`
  CREATE TABLE IF NOT EXISTS mandates (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    source         TEXT    NOT NULL DEFAULT 'upload' CHECK(source IN ('upload','form')),
    client_name    TEXT    NOT NULL DEFAULT '',
    company_name   TEXT    NOT NULL DEFAULT '',
    client_email   TEXT    NOT NULL DEFAULT '',
    reference      TEXT    NOT NULL DEFAULT '',
    amount         REAL,
    filename       TEXT    NOT NULL DEFAULT '',
    filepath       TEXT    NOT NULL DEFAULT '',
    form_data      TEXT    NOT NULL DEFAULT '{}',
    status         TEXT    NOT NULL DEFAULT 'received'
                           CHECK(status IN ('received','loaded','cancelled')),
    notes          TEXT    NOT NULL DEFAULT '',
    created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mandates_status ON mandates(status);
`);

const mandates = {
  all:    db.prepare(`SELECT * FROM mandates ORDER BY created_at DESC, id DESC`),
  byId:   db.prepare(`SELECT * FROM mandates WHERE id = ?`),
  insert: db.prepare(`INSERT INTO mandates (source, client_name, company_name, client_email, reference, amount, filename, filepath, form_data, status, notes)
                      VALUES (@source, @client_name, @company_name, @client_email, @reference, @amount, @filename, @filepath, @form_data, @status, @notes)`),
  update: db.prepare(`UPDATE mandates SET client_name=@client_name, company_name=@company_name, client_email=@client_email,
                      reference=@reference, amount=@amount, status=@status, notes=@notes,
                      updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=@id`),
  delete: db.prepare(`DELETE FROM mandates WHERE id = ?`),
};

module.exports = { db, quotes, contacts, proposals, projects, mandates, bulkUpsertContacts };
