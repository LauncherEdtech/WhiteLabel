# api/app/tasks.py
from app.extensions import celery_app
from flask_mail import Message


@celery_app.task(bind=True, max_retries=3)
def send_broadcast_email(
    self, to_email: str, to_name: str, subject: str, body: str, tenant_name: str
):
    """Envia e-mail de broadcast para um aluno."""
    try:
        from app.extensions import mail
        from flask import current_app

        msg = Message(
            subject=f"[{tenant_name}] {subject}",
            recipients=[to_email],
            body=f"Olá {to_name},\n\n{body}\n\nAtenciosamente,\n{tenant_name}",
            html=f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#4F46E5">{tenant_name}</h2>
              <p>Olá <strong>{to_name}</strong>,</p>
              <p>{body}</p>
              <hr>
              <p style="color:#666;font-size:12px">
                Você recebeu este e-mail pois é aluno da plataforma {tenant_name}.
              </p>
            </div>
            """,
        )
        mail.send(msg)
        return {"status": "sent", "to": to_email}

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3)
def send_password_reset_email(
    self, to_email: str, to_name: str, reset_url: str, tenant_name: str
):
    """Envia e-mail de reset de senha."""
    try:
        from app.extensions import mail

        msg = Message(
            subject=f"[{tenant_name}] Redefinição de senha",
            recipients=[to_email],
            html=f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#4F46E5">{tenant_name}</h2>
              <p>Olá <strong>{to_name}</strong>,</p>
              <p>Clique no botão abaixo para redefinir sua senha:</p>
              <a href="{reset_url}"
                 style="display:inline-block;background:#4F46E5;color:white;
                        padding:12px 24px;border-radius:8px;text-decoration:none;
                        font-weight:bold;margin:16px 0">
                Redefinir senha
              </a>
              <p style="color:#666;font-size:12px">
                Este link expira em 1 hora. Se você não solicitou,
                ignore este e-mail.
              </p>
            </div>
            """,
        )
        mail.send(msg)
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
