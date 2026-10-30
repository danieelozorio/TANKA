#!/bin/sh
# Testa supabase/schema.sql num PostgreSQL local (precisa do servidor rodando).
# Uso: PGHOST=/caminho/do/socket PGPORT=5432 sh testes/banco.test.sh
set -e
cd "$(dirname "$0")/.."
P="psql -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists tanka_teste" -c "create database tanka_teste"
$P -d tanka_teste -f testes/supabase_falso.sql >/dev/null 2>&1
$P -d tanka_teste -f supabase/schema.sql >/dev/null 2>&1
$P -d tanka_teste -f supabase/schema.sql >/dev/null 2>&1   # rodar duas vezes não pode quebrar
$P -t -A -d tanka_teste -f testes/banco.test.sql 2>&1 | sed -n "s/^psql:[^ ]* NOTICE:  //p; /TODOS OS TESTES/p; /FALHA/p"
