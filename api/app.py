# api/app.py
# Entry point da aplicação Flask.
# SEGURANÇA: Importa apenas a factory; nunca instancia app em módulos de modelo.

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Somente para debug local direto (normalmente uso docker-compose)
    app.run(host="0.0.0.0", port=5000, debug=True)