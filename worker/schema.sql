-- Mixes guardados pelo encurtador. Nada expira: um link criado abre para sempre.
CREATE TABLE IF NOT EXISTS mixes (
  code TEXT PRIMARY KEY,
  payload TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- buscas novas por pessoa por dia (who = hash do IP com o dia; o IP não fica guardado)
CREATE TABLE IF NOT EXISTS search_hits (
  who TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0
);
