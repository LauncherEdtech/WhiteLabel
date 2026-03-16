import os


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "troque-isso-em-producao")

    POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB = os.getenv("POSTGRES_DB", "appdb")
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "db")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
        f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB