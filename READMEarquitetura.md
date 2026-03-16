# Arquitetura do projeto WhiteLabel

## Visão geral

Esta é uma aplicação Flask com banco de dados PostgreSQL, executada via Docker Compose.

A arquitetura segue o padrão clássico de backend leve:
- Um serviço `web` em Flask que expõe API REST.
- Um serviço `db` em PostgreSQL para persistência.

## Estrutura de diretórios

```
WhiteLabel/
├─ Dockerfile
├─ docker-compose.yml
├─ .env
├─ requirements.txt
├─ README.md
├─ READMEarquitetura.md
└─ app/
   ├─ __init__.py
   ├─ app.py
   ├─ config.py
   └─ models.py
```

## Serviços Docker

### web (Flask)
- Constrói a partir de `Dockerfile`.
- Mapeia porta 5000 do container para host.
- Usa `flask run --host=0.0.0.0 --port=5000`.
- Monta volume `.:/app` para código ao vivo.
- Depende de `db`.

### db (PostgreSQL)
- Imagem oficial `postgres:15`.
- Variáveis de ambiente definidas em `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).
- Usa volume `postgres_data` para dados persistentes.

## Configuração de aplicação

### app/config.py
- Lê variáveis de ambiente para montar a string `SQLALCHEMY_DATABASE_URI`:
  `postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}`

### app/app.py
- Cria `create_app()`.
- Inicializa `SQLAlchemy` e `Migrate`.
- Define rotas:
  - `/` (saudação)
  - `/users` (GET e POST)
- Cria banco com `db.create_all()` no contexto de app para rodar sem migrations manuais.

### app/models.py
- Define `User` com `id` e `name`.

### `requirements.txt`
- Dependências:
  - Flask
  - Flask-SQLAlchemy
  - psycopg2-binary
  - Flask-Migrate

## Fluxo de execução

1. `docker compose up --build`
2. Compose inicia `db` e `web`.
3. Flask liga em `http://0.0.0.0:5000`.
4. App se conecta ao PostgreSQL em `db:5432`.
5. Endpoints se comunicam com o banco via SQLAlchemy.

## Conexão com banco

Dentro do container:

```bash
docker compose exec db psql -U postgres -d appdb
```

## Rotas para validação

- `GET /` → saúde da API.
- `POST /users` com JSON `{ "name": "Alice" }` → criar usuário.
- `GET /users` → listar usuários.

## Observações

- O ambiente está pronto para expandir com mais rotas, autenticação, templates, testes e APIs RESTful.
- Para desenvolvedor novo: clone, execute `docker compose up --build`, teste os endpoints e comece a implementar novas features em `app/app.py` e `app/models.py`.
