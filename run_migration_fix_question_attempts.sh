#!/bin/bash
# run_migration_fix_question_attempts.sh
# Corrige o UniqueConstraint em question_attempts que causava rollback total
# ao finalizar simulados com questões já respondidas em outros simulados.
#
# v2: Inclui deduplicação de registros duplicados antes de criar os indexes.
#     A migration anterior falhou porque já existiam duplicatas em 'practice'
#     no banco — provavelmente por tentativas de refazer questões.
#
# Uso: bash run_migration_fix_question_attempts.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

CLUSTER="concurso-platform-cluster"
TASK_DEF="concurso-platform-api"
REGION="sa-east-1"
SUBNET="subnet-0d39719baa4b6be33"
SG="sg-043a8e26b38d91b62"
LOG_GROUP="/ecs/concurso-platform/api"

echo "=== Migration: fix_question_attempts_constraint (v2 com dedup) ==="
echo ""

PYTHON_SCRIPT=$(cat << 'PYEOF'
import psycopg2
import os
import sys

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

run(
    "drop uq_attempt_user_question_context",
    "ALTER TABLE question_attempts DROP CONSTRAINT IF EXISTS uq_attempt_user_question_context"
)

cur.execute("""
    SELECT context, COUNT(*) as grupos, SUM(cnt - 1) as a_remover
    FROM (
        SELECT context, user_id, question_id, COUNT(*) as cnt
        FROM question_attempts
        WHERE context != 'simulado' AND is_deleted = FALSE
        GROUP BY context, user_id, question_id
        HAVING COUNT(*) > 1
    ) t
    GROUP BY context ORDER BY context
""")
rows = cur.fetchall()
if rows:
    print("Duplicatas em contextos nao-simulado:", flush=True)
    for ctx, grupos, a_remover in rows:
        print(f"  context={ctx}: {grupos} grupos, {a_remover} a remover", flush=True)
else:
    print("Sem duplicatas em contextos nao-simulado.", flush=True)

cur.execute("""
    SELECT COUNT(*), SUM(cnt-1) FROM (
        SELECT user_id, question_id, simulado_attempt_id, COUNT(*) as cnt
        FROM question_attempts
        WHERE context = 'simulado' AND simulado_attempt_id IS NOT NULL AND is_deleted = FALSE
        GROUP BY user_id, question_id, simulado_attempt_id HAVING COUNT(*) > 1
    ) t
""")
row = cur.fetchone()
if row and row[0] > 0:
    print(f"Duplicatas em simulado: {row[0]} grupos, {row[1]} a remover", flush=True)
else:
    print("Sem duplicatas em contexto simulado.", flush=True)

run(
    "dedup nao-simulado (soft delete, mantém mais recente)",
    """
    UPDATE question_attempts
    SET is_deleted = TRUE, deleted_at = NOW()
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id, question_id, context
                       ORDER BY created_at DESC, id DESC
                   ) AS rn
            FROM question_attempts
            WHERE context != 'simulado' AND is_deleted = FALSE
        ) ranked WHERE rn > 1
    )
    """
)

run(
    "dedup simulado (soft delete, mantém mais recente)",
    """
    UPDATE question_attempts
    SET is_deleted = TRUE, deleted_at = NOW()
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id, question_id, simulado_attempt_id
                       ORDER BY created_at DESC, id DESC
                   ) AS rn
            FROM question_attempts
            WHERE context = 'simulado'
              AND simulado_attempt_id IS NOT NULL
              AND is_deleted = FALSE
        ) ranked WHERE rn > 1
    )
    """
)

cur.execute("""
    SELECT COUNT(*) FROM (
        SELECT user_id, question_id, context
        FROM question_attempts
        WHERE context != 'simulado' AND is_deleted = FALSE
        GROUP BY user_id, question_id, context HAVING COUNT(*) > 1
    ) t
""")
remaining_non_sim = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM (
        SELECT user_id, question_id, simulado_attempt_id
        FROM question_attempts
        WHERE context = 'simulado' AND simulado_attempt_id IS NOT NULL AND is_deleted = FALSE
        GROUP BY user_id, question_id, simulado_attempt_id HAVING COUNT(*) > 1
    ) t
""")
remaining_sim = cur.fetchone()[0]

if remaining_non_sim > 0 or remaining_sim > 0:
    print(f"ERRO: duplicatas restantes — nao-simulado={remaining_non_sim} simulado={remaining_sim}", flush=True)
    sys.exit(1)

print("Validacao OK: sem duplicatas ativas.", flush=True)

run(
    "create uq_attempt_non_simulado",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_non_simulado
    ON question_attempts(user_id, question_id, context)
    WHERE context != 'simulado' AND is_deleted = FALSE
    """
)

run(
    "create uq_attempt_simulado",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_simulado
    ON question_attempts(user_id, question_id, simulado_attempt_id)
    WHERE context = 'simulado' AND is_deleted = FALSE
    """
)

cur.execute("""
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'question_attempts'
      AND indexname IN ('uq_attempt_user_question_context','uq_attempt_non_simulado','uq_attempt_simulado')
    ORDER BY indexname
""")
indexes = [r[0] for r in cur.fetchall()]
print("Indexes presentes:", flush=True)
for idx in indexes:
    print(f"  {idx}", flush=True)

if "uq_attempt_user_question_context" in indexes:
    print("ERRO: constraint antigo ainda existe!", flush=True)
    sys.exit(1)
if "uq_attempt_non_simulado" not in indexes or "uq_attempt_simulado" not in indexes:
    print("ERRO: indexes novos nao foram criados!", flush=True)
    sys.exit(1)

cur.close()
conn.close()
print("", flush=True)
print("=== Migration fix_question_attempts_constraint concluida! ===", flush=True)
PYEOF
)

B64=$(echo "$PYTHON_SCRIPT" | base64 -w 0)

cat > /tmp/migrate-fix-question-attempts.json << EOF
{
  "containerOverrides": [{
    "name": "api",
    "command": ["sh", "-c", "echo $B64 | base64 -d | python3"]
  }]
}
EOF

echo "Override JSON gerado em /tmp/migrate-fix-question-attempts.json"
echo ""

echo "Disparando ECS task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --overrides file:///tmp/migrate-fix-question-attempts.json \
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

echo ""
if [ "$EXIT_CODE" = "0" ]; then
  echo "✅ Migration concluida com sucesso!"
  echo ""
  echo "Proximos passos:"
  echo "  1. Substituir api/app/models/question.py"
  echo "  2. Substituir _get_time_stats() em api/app/routes/analytics.py"
  echo "  3. Substituir _finalize_attempt() em api/app/routes/simulados.py"
  echo "  4. Build + push: ./deploy.sh api"
else
  echo "❌ Migration falhou (exit code $EXIT_CODE). Verifique os logs acima."
  exit 1
fi