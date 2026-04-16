#!/bin/bash
# run_migration_fix_schedule_unique.sh
# Corrige o UniqueConstraint em study_schedules que causava UniqueViolation
# ao tentar gerar um novo cronograma após deletar um existente.
#
# Problema: O constraint "uq_schedule_user_course" em (user_id, course_id)
# não considera is_deleted, então a row soft-deletada continua bloqueando
# a criação de novos schedules para o mesmo par (user, curso).
#
# Solução: Troca o UNIQUE constraint por um partial unique index que só se
# aplica a schedules ATIVOS (is_deleted = false).
#
# COMPATIBILIDADE:
#   - Linux (Codespace, EC2): funciona out-of-the-box
#   - Git Bash no Windows: funciona (usa diretório local em vez de /tmp)
#   - WSL: funciona
#
# Uso: bash run_migration_fix_schedule_unique.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ─── Configuração ────────────────────────────────────────────────────────────
# AWS: Conta 062677866928, região us-east-1 (nova conta)
CLUSTER="concurso-platform-cluster"
TASK_DEF="concurso-platform-api"
REGION="us-east-1"

# Subnets e Security Group obtidos do console AWS (nova conta us-east-1)
SUBNET="subnet-02c2a21aac7844025"
SG="sg-00159856c1b5b061a"

LOG_GROUP="/ecs/concurso-platform/api"

# Arquivo temporário LOCAL (compatível com Git Bash/Windows)
OVERRIDE_JSON="./migrate-fix-schedule-unique.json"

echo "=== Migration: fix_schedule_unique_constraint_for_soft_delete ==="
echo ""
echo "Região: $REGION"
echo "Cluster: $CLUSTER"
echo "Task def: $TASK_DEF"
echo ""

PYTHON_SCRIPT=$(cat << 'PYEOF'
import psycopg2
import os
import sys

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


# ─── 1. Diagnóstico inicial ──────────────────────────────────────────────────

cur.execute("""
    SELECT
        COUNT(*) FILTER (WHERE is_deleted = FALSE) AS ativos,
        COUNT(*) FILTER (WHERE is_deleted = TRUE) AS deletados,
        COUNT(*) AS total
    FROM study_schedules
""")
ativos, deletados, total = cur.fetchone()
print(f"Schedules: total={total} ativos={ativos} deletados={deletados}", flush=True)

cur.execute("""
    SELECT COUNT(*) FROM (
        SELECT user_id, course_id, COUNT(*) AS cnt
        FROM study_schedules
        WHERE is_deleted = FALSE
        GROUP BY user_id, course_id
        HAVING COUNT(*) > 1
    ) t
""")
duplicatas_ativas = cur.fetchone()[0]

if duplicatas_ativas > 0:
    print(f"ATENCAO: {duplicatas_ativas} grupos de schedules ATIVOS duplicados (inesperado)", flush=True)
else:
    print("Sem duplicatas ativas (esperado).", flush=True)

cur.execute("""
    SELECT COUNT(DISTINCT (user_id, course_id))
    FROM study_schedules
    WHERE is_deleted = TRUE
""")
pares_com_deletado = cur.fetchone()[0]
print(f"Pares (user, course) com schedule deletado: {pares_com_deletado}", flush=True)

# ─── 2. Remove o constraint antigo ───────────────────────────────────────────

cur.execute("""
    SELECT COUNT(*) FROM pg_constraint
    WHERE conname = 'uq_schedule_user_course'
      AND conrelid = 'study_schedules'::regclass
""")
constraint_existe = cur.fetchone()[0] > 0

if constraint_existe:
    run(
        "drop uq_schedule_user_course (constraint antigo)",
        "ALTER TABLE study_schedules DROP CONSTRAINT IF EXISTS uq_schedule_user_course"
    )
else:
    print("SKIP | constraint uq_schedule_user_course ja nao existe", flush=True)

# ─── 3. Limpa duplicatas ativas se existirem ─────────────────────────────────

if duplicatas_ativas > 0:
    run(
        "dedup schedules ativos duplicados (soft delete, mantém mais recente)",
        """
        UPDATE study_schedules
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY user_id, course_id
                           ORDER BY
                               CASE WHEN last_reorganized_at IS NOT NULL THEN 0 ELSE 1 END,
                               last_reorganized_at DESC NULLS LAST,
                               created_at DESC,
                               id DESC
                       ) AS rn
                FROM study_schedules
                WHERE is_deleted = FALSE
            ) ranked WHERE rn > 1
        )
        """
    )

    cur.execute("""
        SELECT COUNT(*) FROM (
            SELECT user_id, course_id, COUNT(*) AS cnt
            FROM study_schedules
            WHERE is_deleted = FALSE
            GROUP BY user_id, course_id
            HAVING COUNT(*) > 1
        ) t
    """)
    ainda_duplicado = cur.fetchone()[0]
    if ainda_duplicado > 0:
        print(f"ERRO: ainda {ainda_duplicado} duplicatas apos dedup", flush=True)
        sys.exit(1)
    print("Validacao OK: sem duplicatas ativas apos dedup.", flush=True)

# ─── 4. Cria o partial unique index ──────────────────────────────────────────

run(
    "create uq_schedule_user_course_active (partial index, só ativos)",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_user_course_active
    ON study_schedules(user_id, course_id)
    WHERE is_deleted = FALSE
    """
)

# ─── 5. Validação final ──────────────────────────────────────────────────────

cur.execute("""
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'study_schedules'
      AND indexname IN ('uq_schedule_user_course', 'uq_schedule_user_course_active')
    ORDER BY indexname
""")
indexes = [r[0] for r in cur.fetchall()]
print("Indexes presentes em study_schedules:", flush=True)
for idx in indexes:
    print(f"  {idx}", flush=True)

cur.execute("""
    SELECT COUNT(*) FROM pg_constraint
    WHERE conname = 'uq_schedule_user_course'
      AND conrelid = 'study_schedules'::regclass
""")
if cur.fetchone()[0] > 0:
    print("ERRO: constraint antigo ainda existe!", flush=True)
    sys.exit(1)

if "uq_schedule_user_course_active" not in indexes:
    print("ERRO: partial index nao foi criado!", flush=True)
    sys.exit(1)

cur.execute("""
    SELECT COUNT(*) FROM (
        SELECT user_id, course_id
        FROM study_schedules
        WHERE is_deleted = TRUE
        INTERSECT
        SELECT user_id, course_id
        FROM study_schedules
        WHERE is_deleted = FALSE
    ) t
""")
convivendo = cur.fetchone()[0]
print(f"Pares com schedule deletado E ativo coexistindo: {convivendo}", flush=True)
print("  (se > 0, o partial index esta funcionando corretamente)", flush=True)

cur.close()
conn.close()
print("", flush=True)
print("=== Migration fix_schedule_unique_constraint concluida! ===", flush=True)
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

echo "Override JSON gerado em $OVERRIDE_JSON"
echo ""

echo "Disparando ECS task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides "file://$OVERRIDE_JSON" \
  --region "$REGION" \
  --query "tasks[0].taskArn" \
  --output text)

echo "Task ARN: $TASK_ARN"
TASK_ID="${TASK_ARN##*/}"
echo "Task ID:  $TASK_ID"
echo ""

echo "Aguardando conclusao (max 5min)..."
aws ecs wait tasks-stopped \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION"

EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --region "$REGION" \
  --query "tasks[0].containers[0].exitCode" \
  --output text)

echo ""
echo "Exit code: $EXIT_CODE"

echo ""
echo "=== LOGS ==="
LOG_STREAM="api/api/$TASK_ID"
aws logs get-log-events \
  --log-group-name "$LOG_GROUP" \
  --log-stream-name "$LOG_STREAM" \
  --region "$REGION" \
  --query "events[*].message" \
  --output text 2>/dev/null || echo "(logs ainda nao disponiveis — aguarde ~30s e rode manualmente)"

rm -f "$OVERRIDE_JSON"

echo ""
if [ "$EXIT_CODE" = "0" ]; then
  echo "Migration concluida com sucesso!"
  echo ""
  echo "Proximos passos:"
  echo "  1. Substituir api/app/services/schedule_engine.py (v8.3)"
  echo "  2. Substituir api/app/routes/schedule.py (v8.3)"
  echo "  3. Substituir frontend/src/app/(student)/schedule/page.tsx"
  echo "  4. Build + push: ./deploy.sh all"
else
  echo "Migration falhou (exit code $EXIT_CODE). Verifique os logs acima."
  exit 1
fi