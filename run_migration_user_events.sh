#!/bin/bash
# run_migration_user_events.sh
# Cria a tabela user_events para tracking comportamental dos alunos.
#
# Tabela registra eventos genéricos: page_view, mentor_click, insight_view, etc.
# Não interfere em nenhuma tabela existente — pura adição.
#
# COMPATIBILIDADE: Linux, Git Bash, WSL
# Uso: bash run_migration_user_events.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

CLUSTER="concurso-platform-cluster"
TASK_DEF="concurso-platform-api"
REGION="us-east-1"
SUBNET="subnet-02c2a21aac7844025"
SG="sg-00159856c1b5b061a"
LOG_GROUP="/ecs/concurso-platform/api"
OVERRIDE_JSON="./migrate-user-events.json"

echo "=== Migration: add_user_events_table ==="
echo ""
echo "Região: $REGION  |  Cluster: $CLUSTER  |  Task def: $TASK_DEF"
echo ""

PYTHON_SCRIPT=$(cat << 'PYEOF'
import psycopg2
import os
import sys

NEW_REVISION = "e7c1a9b2d4f8"
EXPECTED_DOWN = "f3g4h5i6j7k8"

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()


def run(label, sql, args=None):
    try:
        cur.execute(sql, args)
        conn.commit()
        print(f"OK  | {label}", flush=True)
    except Exception as e:
        conn.rollback()
        print(f"ERR | {label}: {e}", flush=True)
        raise


# ─── 1. Diagnóstico inicial ───────────────────────────────────────────────────

cur.execute("""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'user_events'
    )
""")
tabela_existe = cur.fetchone()[0]
print(f"Tabela user_events existe: {tabela_existe}", flush=True)

cur.execute("SELECT version_num FROM alembic_version")
versions_antes = [r[0] for r in cur.fetchall()]
print(f"Alembic versions antes: {versions_antes}", flush=True)
print("", flush=True)

# ─── 2. Cria tabela user_events ───────────────────────────────────────────────

run(
    "create table user_events",
    """
    CREATE TABLE IF NOT EXISTS user_events (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id UUID NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        feature_name VARCHAR(50),
        target_id UUID,
        event_metadata JSONB,
        client_timestamp TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL
    )
    """
)

# ─── 3. Cria índices ──────────────────────────────────────────────────────────

run(
    "create index ix_user_events_tenant_id",
    "CREATE INDEX IF NOT EXISTS ix_user_events_tenant_id ON user_events (tenant_id)"
)
run(
    "create index ix_events_tenant_type_time",
    """
    CREATE INDEX IF NOT EXISTS ix_events_tenant_type_time
    ON user_events (tenant_id, event_type, created_at)
    """
)
run(
    "create index ix_events_tenant_user_time",
    """
    CREATE INDEX IF NOT EXISTS ix_events_tenant_user_time
    ON user_events (tenant_id, user_id, created_at)
    """
)
run(
    "create index ix_events_tenant_feature_time",
    """
    CREATE INDEX IF NOT EXISTS ix_events_tenant_feature_time
    ON user_events (tenant_id, feature_name, created_at)
    """
)
run(
    "create index ix_events_tenant_session",
    """
    CREATE INDEX IF NOT EXISTS ix_events_tenant_session
    ON user_events (tenant_id, session_id)
    """
)

# ─── 4. Stamp seguro no alembic_version ───────────────────────────────────────
# Não usa INSERT ON CONFLICT direto: evita risco de criar múltiplas rows
# (cenário que confunde Alembic e simula "múltiplos heads").

if NEW_REVISION in versions_antes:
    print(f"OK  | alembic_version já contém {NEW_REVISION}", flush=True)
elif len(versions_antes) == 0:
    cur.execute(
        "INSERT INTO alembic_version (version_num) VALUES (%s)",
        (NEW_REVISION,)
    )
    conn.commit()
    print(f"OK  | alembic_version inserida: {NEW_REVISION} (tabela estava vazia)", flush=True)
elif len(versions_antes) == 1 and versions_antes[0] == EXPECTED_DOWN:
    cur.execute(
        "UPDATE alembic_version SET version_num = %s",
        (NEW_REVISION,)
    )
    conn.commit()
    print(f"OK  | alembic_version atualizada de {EXPECTED_DOWN} para {NEW_REVISION}", flush=True)
else:
    print(f"ERR | estado inesperado em alembic_version: {versions_antes}", flush=True)
    print(f"      Esperado: [{EXPECTED_DOWN!r}] ou vazio", flush=True)
    print(f"      Tabela user_events foi criada, mas stamp não foi aplicado.", flush=True)
    print(f"      Resolva manualmente o alembic_version antes de continuar.", flush=True)
    sys.exit(1)

# ─── 5. Validação final ───────────────────────────────────────────────────────

cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'user_events'
    ORDER BY ordinal_position
""")
print("", flush=True)
print("Schema user_events:", flush=True)
for col in cur.fetchall():
    print(f"  - {col[0]:20s} {col[1]:25s} nullable={col[2]}", flush=True)

cur.execute("""
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'user_events'
    ORDER BY indexname
""")
print("", flush=True)
print("Índices em user_events:", flush=True)
for idx in cur.fetchall():
    print(f"  - {idx[0]}", flush=True)

cur.execute("SELECT COUNT(*) FROM user_events")
total = cur.fetchone()[0]
print(f"\nTotal de eventos atuais: {total}", flush=True)

cur.execute("SELECT version_num FROM alembic_version")
versions_depois = [r[0] for r in cur.fetchall()]
print(f"Alembic versions depois: {versions_depois}", flush=True)

cur.close()
conn.close()
print("", flush=True)
print("=== Migration add_user_events_table concluída com sucesso! ===", flush=True)
PYEOF
)

B64=$(echo "$PYTHON_SCRIPT" | base64 -w 0)

cat > "$OVERRIDE_JSON" << EOF
{
  "containerOverrides": [{
    "name": "api",
    "command": ["sh", "-c", "echo $B64 | base64 -d | python3"]
  }]
}
EOF

echo "Override JSON gerado: $OVERRIDE_JSON"
echo ""

echo "Disparando ECS task..."
TASK_ARN=$(MSYS_NO_PATHCONV=1 aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides "file://$OVERRIDE_JSON" \
  --region "$REGION" \
  --profile launcher-admin \
  --query "tasks[0].taskArn" \
  --output text)

echo "Task ARN: $TASK_ARN"
TASK_ID="${TASK_ARN##*/}"
echo "Task ID:  $TASK_ID"
echo ""

echo "Aguardando conclusão (max 5min)..."
MSYS_NO_PATHCONV=1 aws ecs wait tasks-stopped \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION" \
  --profile launcher-admin

EXIT_CODE=$(MSYS_NO_PATHCONV=1 aws ecs describe-tasks \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION" \
  --profile launcher-admin \
  --query "tasks[0].containers[0].exitCode" \
  --output text)

echo ""
echo "Exit code: $EXIT_CODE"
echo ""
echo "=== LOGS ==="
LOG_STREAM="api/api/$TASK_ID"
MSYS_NO_PATHCONV=1 aws logs get-log-events \
  --log-group-name "$LOG_GROUP" \
  --log-stream-name "$LOG_STREAM" \
  --region "$REGION" \
  --profile launcher-admin \
  --query "events[*].message" \
  --output text 2>/dev/null || echo "(logs ainda não disponíveis — aguarde ~30s e rode manualmente)"

rm -f "$OVERRIDE_JSON"

echo ""
if [ "$EXIT_CODE" = "0" ]; then
  echo "✓ Migration concluída com sucesso!"
  echo ""
  echo "Próximos passos:"
  echo "  1. Faz o deploy do código (./deploy.sh api) para subir os endpoints /events/*"
  echo "  2. Testa via curl: POST /api/v1/events/track"
  echo "  3. Confirma que está chegando: GET /api/v1/events/recent (super_admin)"
else
  echo "✗ Migration falhou (exit code $EXIT_CODE). Verifique os logs acima."
  exit 1
fi