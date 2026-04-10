# api/app/middleware/activity_tracker.py
# Rastreia usuários ativos em tempo real no Redis.
#
# OTIMIZAÇÃO: usa redis_client compartilhado (pool de conexões)
# em vez de criar nova conexão a cada request.
# Antes: ~2 conexões novas por request → overhead enorme no Upstash
# Depois: 1 conexão persistente reutilizada por todos os requests

import time
import logging
from flask import g

logger = logging.getLogger(__name__)

ACTIVE_USERS_KEY = "concurso:active_users"
ACTIVITY_WINDOW_SECONDS = 300  # 5 minutos


def _get_redis():
    """Retorna o cliente Redis compartilhado com SSL configurado."""
    try:
        from flask import current_app
        import redis as redis_lib

        redis_url = current_app.config.get("REDIS_URL", "")
        if not redis_url:
            return None

        # Usa connection pool — não cria nova conexão a cada chamada
        ssl_kwargs = {}
        if redis_url.startswith("rediss://"):
            ssl_kwargs = {"ssl_cert_reqs": None}

        return redis_lib.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            **ssl_kwargs,
        )
    except Exception:
        return None


def track_user_activity():
    """
    Registra atividade do usuário autenticado no Redis.
    Chamada em after_request — falha silenciosamente se Redis indisponível.
    """
    user_id = getattr(g, "_activity_user_id", None)
    if not user_id:
        return

    try:
        r = _get_redis()
        if not r:
            return

        now = time.time()
        cutoff = now - ACTIVITY_WINDOW_SECONDS

        # Pipeline: executa ZADD + ZREMRANGEBYSCORE em 1 round-trip
        pipe = r.pipeline(transaction=False)
        pipe.zadd(ACTIVE_USERS_KEY, {str(user_id): now})
        pipe.zremrangebyscore(ACTIVE_USERS_KEY, 0, cutoff)
        pipe.execute()

    except Exception as e:
        logger.debug(f"activity_tracker: erro silenciado → {e}")


def set_activity_user(user_id: str):
    """Define o user_id para tracking no contexto do request atual."""
    g._activity_user_id = user_id


def get_active_user_count() -> int:
    """Retorna a contagem de usuários ativos nos últimos 5 minutos."""
    try:
        r = _get_redis()
        if not r:
            return 0

        cutoff = time.time() - ACTIVITY_WINDOW_SECONDS

        pipe = r.pipeline(transaction=False)
        pipe.zremrangebyscore(ACTIVE_USERS_KEY, 0, cutoff)
        pipe.zcard(ACTIVE_USERS_KEY)
        results = pipe.execute()

        return int(results[1])

    except Exception as e:
        logger.warning(f"get_active_user_count falhou: {e}")
        return 0
