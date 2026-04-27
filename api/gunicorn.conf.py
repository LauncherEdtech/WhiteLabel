# api/gunicorn.conf.py
# Configuração de produção do Gunicorn.
# Referenciado pelo CMD do Dockerfile: gunicorn --config gunicorn.conf.py wsgi:app
#
# PROBLEMA ORIGINAL:
#   --preload faz o Gunicorn carregar o app no processo master e depois
#   faz fork() para criar os workers. O SQLAlchemy cria o connection pool
#   ANTES do fork, e os workers herdam as mesmas conexões abertas.
#   Múltiplos processos usando a mesma conexão TCP → corrupção, timeouts,
#   e ConnectionRefused — exatamente os 2.713 erros do load test.
#
# SOLUÇÃO:
#   post_fork() descarta o pool do processo filho imediatamente após o fork.
#   Cada worker cria suas próprias conexões frescas na primeira query.
#   O --preload é mantido (economiza memória via copy-on-write no Linux).

import multiprocessing
import os

# ── Binding ───────────────────────────────────────────────────────────────────
bind = "0.0.0.0:5000"

# ── Workers ───────────────────────────────────────────────────────────────────
# Fórmula padrão: (2 × CPU cores) + 1
# Em ECS/EC2 com 2 vCPUs → 5 workers
# Em ECS/EC2 com 4 vCPUs → 9 workers
# Sobrescrevível via env var WEB_CONCURRENCY (Railway, Render, ECS)
workers = int(os.environ.get("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))

# Threads por worker — permite I/O concorrente dentro do mesmo processo
# 4 workers × 4 threads = 16 requests simultâneos por vCPU
threads = int(os.environ.get("GUNICORN_THREADS", 4))

# Worker class síncrono com threads — compatível com Flask/SQLAlchemy sem gevent
worker_class = "gthread"

# ── Timeouts ──────────────────────────────────────────────────────────────────
# timeout: mata workers que não respondem em N segundos (evita requests de 82s)
# ANTES: 120s → requests ficavam pendurados, fila explodia no ramp-up
# AGORA: 30s → retorna 503 rapidamente, cliente pode retry, fila não acumula
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 30))

# Tempo para worker terminar requisições em andamento antes de ser morto (graceful)
graceful_timeout = 10

# Keep-alive para conexões HTTP persistentes
keepalive = 5

# ── Preload ───────────────────────────────────────────────────────────────────
# Mantido True: economiza memória (copy-on-write) e acelera startup dos workers.
# O post_fork() abaixo resolve o problema de pool compartilhado.
preload_app = True

# ── Hooks de ciclo de vida ────────────────────────────────────────────────────

def post_fork(server, worker):
    """
    Executado em cada worker APÓS o fork().

    CRÍTICO: descarta todas as conexões herdadas do processo master.
    Sem isso, múltiplos workers compartilham as mesmas conexões TCP
    ao banco → corrupção de protocolo → ConnectionRefused/Reset.
    """
    from app.extensions import db
    try:
        db.engine.dispose(close=False)
        # close=False: fecha apenas as conexões no pool do filho
        # sem enviar comando de fechamento ao banco (conexão já pertence ao pai)
        server.log.info(f"[worker {worker.pid}] Pool SQLAlchemy descartado — conexões frescas serão criadas")
    except Exception as e:
        server.log.warning(f"[worker {worker.pid}] post_fork dispose falhou: {e}")


def worker_exit(server, worker):
    """Fecha conexões do banco ao encerrar um worker."""
    from app.extensions import db
    try:
        db.engine.dispose()
    except Exception:
        pass


def on_starting(server):
    server.log.info(
        f"Gunicorn iniciando: workers={workers} threads={threads} "
        f"timeout={timeout}s worker_class={worker_class}"
    )

# ── Logging ───────────────────────────────────────────────────────────────────
accesslog = "-"          # stdout
errorlog = "-"           # stderr
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'