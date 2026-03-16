# WhiteLabel

## Ambiente de desenvolvimento Flask + PostgreSQL (Docker)

### 1) Como rodar

1. Instale Docker e Docker Compose.
2. Na raiz do projeto, execute:

```bash
docker compose up --build
```

3. O backend estará em: http://localhost:5000

### 2) Endpoints disponíveis

- `GET /` → teste de saúde
- `GET /users` → lista todos os usuários
- `POST /users` com JSON `{"name":"Alice"}` → cria usuário no PostgreSQL

### 3) Comandos úteis

- Parar: `docker compose down`
- Entrar no web container: `docker compose exec web bash`
- Entrar no db container (psql): `docker compose exec db psql -U postgres -d appdb`

### 4) Como testar via curl

```bash
curl -s localhost:5000/
curl -s -X POST localhost:5000/users -H 'Content-Type: application/json' -d '{"name":"Alice"}'
curl -s localhost:5000/users
```

### 5) Detalhes do banco

- Host: `db` (dentro do container)
- Porta: `5432`
- Usuário: `postgres`
- Senha: `postgres`
- Banco: `appdb`

### 6) Arquivos principais

- `Dockerfile` — imagem do Python/Flask
- `docker-compose.yml` — serviços `web` e `db`
- `.env` — variáveis do banco
- `requirements.txt` — dependências Python
- `app/config.py` — URI do PostgreSQL e config SQLAlchemy
- `app/app.py` — app Flask e rotas
- `app/models.py` — modelo `User`

### 7) Atualizações que fizemos

- Criamos app Flask com SQLAlchemy/Flask-Migrate
- Implementamos CRUD básico de usuários
- Validamos endpoints com `curl`
- Criamos ambiente local rodando com Docker Compose

