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


@celery_app.task(bind=True, max_retries=3)
def send_welcome_email(
    self,
    to_email: str,
    to_name: str,
    password: str,
    tenant_name: str,
    platform_url: str,
    support_email: str = "",
):
    """Envia e-mail de boas-vindas com credenciais de acesso ao novo aluno."""
    try:
        from app.extensions import mail

        msg = Message(
            subject=f"[{tenant_name}] Seu acesso à plataforma",
            recipients=[to_email],
            body=(
                f"Olá {to_name},\n\n"
                f"Seu acesso à plataforma {tenant_name} foi criado!\n\n"
                f"E-mail: {to_email}\n"
                f"Senha:  {password}\n\n"
                f"Acesse agora: {platform_url}\n\n"
                f"Recomendamos alterar sua senha após o primeiro acesso.\n\n"
                f"Atenciosamente,\n{tenant_name}"
            ),
            html=f"""
            <div style="font-family:Arial,sans-serif;max-width:600px;
                        margin:0 auto;background:#f9fafb;padding:32px">
              <div style="background:white;border-radius:12px;padding:32px;
                          box-shadow:0 1px 3px rgba(0,0,0,.1)">

                <h2 style="color:#4F46E5;margin:0 0 8px">
                  Bem-vindo(a) à {tenant_name}! 🎓
                </h2>
                <p style="color:#6B7280;margin:0 0 24px">
                  Sua conta foi criada. Confira suas credenciais de acesso:
                </p>

                <div style="background:#F3F4F6;border-radius:8px;
                            padding:20px;margin-bottom:24px">
                  <p style="margin:0 0 8px;color:#374151;font-size:14px">
                    <strong>E-mail:</strong> {to_email}
                  </p>
                  <p style="margin:0;color:#374151;font-size:14px">
                    <strong>Senha:</strong>
                    <span style="background:#E5E7EB;padding:2px 8px;
                                 border-radius:4px;font-family:monospace">
                      {password}
                    </span>
                  </p>
                </div>

                <a href="{platform_url}"
                   style="display:inline-block;background:#4F46E5;color:white;
                          padding:12px 28px;border-radius:8px;
                          text-decoration:none;font-weight:bold;
                          font-size:15px;margin-bottom:24px">
                  Acessar a plataforma →
                </a>

                <p style="color:#9CA3AF;font-size:12px;margin:0">
                  Recomendamos alterar sua senha após o primeiro acesso.
                  {"<br>Dúvidas? Entre em contato: " + support_email if support_email else ""}
                </p>
              </div>
            </div>
            """,
        )
        mail.send(msg)
        return {"status": "sent", "to": to_email}

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)