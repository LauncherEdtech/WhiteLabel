# api/app/middleware/activity_tracker.py
# Rastreia usuários ativos em tempo real no Redis.
#
# COMO FUNCIONA:
#   1. Após cada request autenticado, registra o user_id num sorted set Redis
#   2. O score é o timestamp Unix atual (permite filtrar por janela de tempo)
#   3. Uma task Celery (cloudwatch_metrics.py) lê esse sorted set a cada 1 min
#      e publica a contagem como Custom Metric no CloudWatch
#   4. O Auto Scaling reage a essa métrica (mais preciso que CPU pura)
#
# CUSTO: ~$0.30/mês (1 custom metric no CloudWatch)
# OVERHEAD: < 1ms por request (operação Redis O(log N))
# ─────────────────────────────────────────────────────────────────────────────

import time
import logging
from flask import request, g

logger = logging.getLogger(__name__)

# Chave do sorted set no Redis
ACTIVE_USERS_KEY = "concurso:active_users"

# Janela de "ativo" = 5 minutos (300 segundos)
# Usuário sem request por 5 min = inativo (não conta para scaling)
ACTIVITY_WINDOW_SECONDS = 300


def track_user_activity():
    """
    Registra atividade do usuário autenticado no Redis.

    Deve ser chamada em after_request dentro do contexto Flask.
    Usa g.current_user_id definido pelo JWT loader, ou extrai do g.tenant se disponível.

    Ignora silenciosamente se:
    - Usuário não está autenticado (request público)
    - Redis não está disponível (não quebra o request)
    """
    # Só rastreia requests autenticados
    user_id = getattr(g, "_activity_user_id", None)
    if not user_id:
        return

    try:
        from app.extensions import db
        import redis as redis_lib
        from flask import current_app

        redis_url = current_app.config.get("REDIS_URL", "")
        if not redis_url:
            return

        # Conecta ao Redis (usa pool de conexões em produção)
        r = redis_lib.from_url(redis_url, decode_responses=True)

        now = time.time()

        # Adiciona/atualiza o user no sorted set com o timestamp atual como score
        # ZADD é idempotente: se o user já existe, apenas atualiza o score
        r.zadd(ACTIVE_USERS_KEY, {str(user_id): now})

        # Remove entradas antigas (fora da janela de 5 min) de forma oportunista
        # Isso mantém o sorted set limpo sem precisar de job separado
        cutoff = now - ACTIVITY_WINDOW_SECONDS
        r.zremrangebyscore(ACTIVE_USERS_KEY, 0, cutoff)

    except Exception as e:
        # NUNCA falha o request por causa do tracking
        logger.debug(f"activity_tracker: erro silenciado → {e}")


def set_activity_user(user_id: str):
    """
    Define o user_id para tracking no contexto do request atual.
    Deve ser chamado pelos JWT loaders ou após verificação de token.

    Uso:
        from app.middleware.activity_tracker import set_activity_user
        set_activity_user(get_jwt_identity())
    """
    g._activity_user_id = user_id


def get_active_user_count() -> int:
    """
    Retorna a contagem de usuários ativos nos últimos 5 minutos.
    Usado pela task Celery para publicar no CloudWatch.
    """
    try:
        import redis as redis_lib
        from flask import current_app

        redis_url = current_app.config.get("REDIS_URL", "")
        if not redis_url:
            return 0

        r = redis_lib.from_url(redis_url, decode_responses=True)

        cutoff = time.time() - ACTIVITY_WINDOW_SECONDS

        # Remove entradas antigas antes de contar
        r.zremrangebyscore(ACTIVE_USERS_KEY, 0, cutoff)

        # Conta usuários com atividade nos últimos 5 min
        count = r.zcard(ACTIVE_USERS_KEY)
        return int(count)

    except Exception as e:
        logger.warning(f"get_active_user_count falhou: {e}")
        return 0
