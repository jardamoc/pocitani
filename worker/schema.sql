-- Databaze D1 pro hlaseni dohranych kol (worker/index.js).
-- Spusteni: npx wrangler d1 execute pocitani --remote --file worker/schema.sql
CREATE TABLE IF NOT EXISTS kola (
  id TEXT PRIMARY KEY,        -- gameId z aplikace, hlida dvoji odeslani
  at INTEGER NOT NULL,        -- kdy kolo skoncilo (ms)
  prijato INTEGER NOT NULL,   -- kdy prislo na server (ms), pro pojistku proti zaplaveni
  zarizeni TEXT NOT NULL,
  data TEXT NOT NULL          -- cele shrnuti kola jako JSON
);
CREATE INDEX IF NOT EXISTS kola_at ON kola (at);
CREATE INDEX IF NOT EXISTS kola_prijato ON kola (prijato);
