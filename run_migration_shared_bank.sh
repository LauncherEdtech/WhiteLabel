#!/bin/bash
# run_migration_shared_bank.sh
# Executa a migration do banco compartilhado de questões via ECS one-off task
#
# Uso: bash run_migration_shared_bank.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

CLUSTER="concurso-platform-cluster"
TASK_DEF="concurso-platform-api"
REGION="sa-east-1"
SUBNET="subnet-0d39719baa4b6be33"
SG="sg-043a8e26b38d91b62"
LOG_GROUP="/ecs/concurso-platform/api"

echo "=== Migration: shared_question_bank ==="
echo ""

# ── Gera o script Python e codifica em base64 ─────────────────────────────────
PYTHON_SCRIPT=$(cat << 'PYEOF'
import psycopg2, os, hashlib, re, unicodedata, json

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur  = conn.cursor()

def run(label, sql, args=None):
    try:
        cur.execute(sql, args)
        conn.commit()
        print(f"OK  | {label}", flush=True)
    except Exception as e:
        conn.rollback()
        print(f"ERR | {label}: {e}", flush=True)
        raise

run("pg_trgm", "CREATE EXTENSION IF NOT EXISTS pg_trgm")

run("enum review_status", """
DO $$ BEGIN
    CREATE TYPE review_status_enum AS ENUM ('approved', 'pending', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$""")

run("enum question_type", """
DO $$ BEGIN
    CREATE TYPE question_type_enum AS ENUM
        ('interpretacao', 'aplicacao', 'raciocinio', 'memorizacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$""")

run("questions.tenant_id nullable",
    "ALTER TABLE questions ALTER COLUMN tenant_id DROP NOT NULL")

cols = [
    ("external_id",            "VARCHAR(64)"),
    ("statement_hash",         "VARCHAR(32)"),
    ("question_type",          "question_type_enum"),
    ("tip",                    "TEXT"),
    ("review_status",          "review_status_enum NOT NULL DEFAULT 'approved'"),
    ("rejection_reason",       "TEXT"),
    ("submitted_by_tenant_id", "UUID REFERENCES tenants(id) ON DELETE SET NULL"),
    ("submitted_by_user_id",   "UUID REFERENCES users(id) ON DELETE SET NULL"),
    ("reviewed_by_user_id",    "UUID REFERENCES users(id) ON DELETE SET NULL"),
    ("reviewed_at",            "TIMESTAMP"),
]
for name, typedef in cols:
    run(f"ADD questions.{name}",
        f"ALTER TABLE questions ADD COLUMN IF NOT EXISTS {name} {typedef}")

run("alternatives.tenant_id nullable",
    "ALTER TABLE alternatives ALTER COLUMN tenant_id DROP NOT NULL")
run("question_tags.tenant_id nullable",
    "ALTER TABLE question_tags ALTER COLUMN tenant_id DROP NOT NULL")

run("uq external_id", """
DO $$ BEGIN
    ALTER TABLE questions ADD CONSTRAINT uq_questions_external_id UNIQUE (external_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$""")

run("uq question_tag", """
DO $$ BEGIN
    ALTER TABLE question_tags ADD CONSTRAINT uq_question_tag UNIQUE (question_id, tag);
EXCEPTION WHEN duplicate_table THEN NULL; END $$""")

indexes = [
    ("ix_statement_hash",
     "CREATE INDEX IF NOT EXISTS ix_questions_statement_hash ON questions (statement_hash)"),
    ("ix_review_status",
     "CREATE INDEX IF NOT EXISTS ix_questions_review_status ON questions (review_status)"),
    ("ix_submitted_by_tenant",
     "CREATE INDEX IF NOT EXISTS ix_questions_submitted_by_tenant ON questions (submitted_by_tenant_id)"),
    ("ix_global_bank",
     "CREATE INDEX IF NOT EXISTS ix_questions_global_bank ON questions (discipline, difficulty, review_status) WHERE tenant_id IS NULL AND source_type = 'bank'"),
    ("ix_pending_review",
     "CREATE INDEX IF NOT EXISTS ix_questions_pending_review ON questions (submitted_by_tenant_id, created_at) WHERE review_status = 'pending'"),
    ("ix_statement_trgm",
     "CREATE INDEX IF NOT EXISTS ix_questions_statement_trgm ON questions USING gin (statement gin_trgm_ops) WHERE tenant_id IS NULL AND source_type = 'bank'"),
]
for label, sql in indexes:
    run(label, sql)

def normalize(text):
    t = text.lower().strip()
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9\s]", "", t)
    return re.sub(r"\s+", " ", t).strip()

def stmt_hash(text):
    return hashlib.md5(normalize(text).encode("utf-8")).hexdigest()

cur.execute("SELECT id, statement FROM questions WHERE statement_hash IS NULL AND statement IS NOT NULL")
rows = cur.fetchall()
print(f"Populando statement_hash: {len(rows)} questoes", flush=True)
for i, (qid, stmt) in enumerate(rows):
    cur.execute("UPDATE questions SET statement_hash = %s WHERE id = %s", (stmt_hash(stmt), qid))
    if i % 200 == 0 and i > 0:
        conn.commit()
        print(f"  {i}/{len(rows)}...", flush=True)
conn.commit()
print(f"  statement_hash OK ({len(rows)} questoes)", flush=True)

cur.execute("SELECT id, features FROM tenants WHERE features IS NOT NULL")
tenants = cur.fetchall()
updated = 0
for tid, features in tenants:
    if features and "question_bank_concursos" not in features:
        features["question_bank_concursos"] = False
        cur.execute("UPDATE tenants SET features = %s WHERE id = %s",
                    (json.dumps(features), tid))
        updated += 1
conn.commit()
print(f"Tenants atualizados: {updated}", flush=True)

cur.close()
conn.close()
print("\n=== Migration shared_question_bank concluida! ===", flush=True)
PYEOF
)

B64=$(echo "$PYTHON_SCRIPT" | base64 -w 0)

# ── Gera o JSON de override ───────────────────────────────────────────────────
cat > /tmp/migrate-shared-bank.json << EOF
{
  "containerOverrides": [{
    "name": "api",
    "command": ["sh", "-c", "echo $B64 | base64 -d | python3"]
  }]
}
EOF

echo "Override JSON gerado em /tmp/migrate-shared-bank.json"
echo ""

# ── Dispara o task ────────────────────────────────────────────────────────────
echo "Disparando ECS task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides file:///tmp/migrate-shared-bank.json \
  --region "$REGION" \
  --query "tasks[0].taskArn" \
  --output text)

echo "Task ARN: $TASK_ARN"
TASK_ID="${TASK_ARN##*/}"
echo "Task ID:  $TASK_ID"
echo ""

# ── Aguarda conclusão ─────────────────────────────────────────────────────────
echo "Aguardando conclusao (max 5min)..."
aws ecs wait tasks-stopped \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION"

# ── Verifica exit code ────────────────────────────────────────────────────────
EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION" \
  --query "tasks[0].containers[0].exitCode" \
  --output text)

echo ""
echo "Exit code: $EXIT_CODE"

# ── Exibe logs ────────────────────────────────────────────────────────────────
echo ""
echo "=== LOGS ==="
LOG_STREAM="api/api/$TASK_ID"
aws logs get-log-events \
  --log-group-name "$LOG_GROUP" \
  --log-stream-name "$LOG_STREAM" \
  --region "$REGION" \
  --query "events[*].message" \
  --output text 2>/dev/null || echo "(logs ainda nao disponiveis — aguarde ~30s e rode manualmente)"

echo ""
if [ "$EXIT_CODE" = "0" ]; then
  echo "✅ Migration concluida com sucesso!"
else
  echo "❌ Migration falhou (exit code $EXIT_CODE). Verifique os logs acima."
  exit 1
fi