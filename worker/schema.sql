-- Mixes guardados pelo encurtador. Nada expira: um link criado abre para sempre.
CREATE TABLE IF NOT EXISTS mixes (
  code TEXT PRIMARY KEY,
  payload TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
