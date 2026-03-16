-- infra/postgres/init.sql
-- Executado UMA VEZ na criação do banco.
-- Habilita extensões necessárias para a plataforma.

-- UUID nativo do Postgres (usado como PK em todas as tabelas)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Busca full-text em português (questões, conteúdo)
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Criptografia adicional no banco (senhas de integração, tokens)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";