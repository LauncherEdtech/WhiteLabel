# wsgi.py — entry point para Gunicorn em produção
# Separa do app.py para evitar conflito com o pacote app/
import sys
import os

# Garante que o diretório atual está no path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app

application = create_app()
app = application  # alias para compatibilidade

if __name__ == "__main__":
    application.run(host="0.0.0.0", port=5000)
