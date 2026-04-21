# api/app/tasks.py
import logging
import os

from app.extensions import celery_app

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS — EMAIL
# ══════════════════════════════════════════════════════════════════════════════

def _send_via_resend(to_email: str, subject: str, html: str) -> dict:
    """
    Envia email via Resend API.
    Usa RESEND_API_KEY e MAIL_DEFAULT_SENDER das env vars.
    """
    import resend

    resend.api_key = os.environ.get("RESEND_API_KEY", "")
    from_address = os.environ.get("MAIL_DEFAULT_SENDER", "noreply@launcheredu.com.br")

    response = resend.Emails.send({
        "from": from_address,
        "to": [to_email],
        "subject": subject,
        "html": html,
    })
    return response


def _email_header(tenant_name: str, logo_url: str = "", primary_color: str = "#4F46E5") -> str:
    """Gera o cabeçalho do email com logo ou nome do tenant."""
    if logo_url:
        brand_block = (
            f'<img src="{logo_url}" alt="{tenant_name}" '
            f'style="max-height:48px;max-width:200px;object-fit:contain;" />'
        )
    else:
        brand_block = (
            f'<span style="font-size:20px;font-weight:700;color:{primary_color};">'
            f'{tenant_name}</span>'
        )
    return (
        f'<div style="background:{primary_color};padding:24px 32px;border-radius:12px 12px 0 0;text-align:center;">'
        f'{brand_block}'
        f'</div>'
    )


def _email_footer(tenant_name: str) -> str:
    return (
        f'<div style="padding:20px 32px;text-align:center;border-top:1px solid #E5E7EB;">'
        f'<p style="margin:0;color:#9CA3AF;font-size:12px;">'
        f'© {tenant_name} · Todos os direitos reservados'
        f'</p>'
        f'</div>'
    )


def _email_wrapper(header: str, body: str, footer: str) -> str:
    return (
        f'<!DOCTYPE html><html><head><meta charset="utf-8">'
        f'<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        f'<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,sans-serif;">'
        f'<table width="100%" cellpadding="0" cellspacing="0" style="min-height:100vh;background:#F3F4F6;">'
        f'<tr><td align="center" style="padding:40px 16px;">'
        f'<div style="max-width:560px;width:100%;background:#FFFFFF;border-radius:12px;'
        f'box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden;">'
        f'{header}{body}{footer}'
        f'</div>'
        f'</td></tr></table>'
        f'</body></html>'
    )


# ══════════════════════════════════════════════════════════════════════════════
# E-MAIL TASKS
# ══════════════════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, max_retries=3, ignore_result=True)
def send_broadcast_email(self, to_email, to_name, subject, body, tenant_name,
                         logo_url="", primary_color="#4F46E5"):
    try:
        header = _email_header(tenant_name, logo_url, primary_color)
        content = (
            f'<div style="padding:32px;">'
            f'<p style="margin:0 0 16px;color:#374151;font-size:15px;">Olá <strong>{to_name}</strong>,</p>'
            f'<div style="color:#4B5563;font-size:15px;line-height:1.6;">{body}</div>'
            f'</div>'
        )
        footer = _email_footer(tenant_name)
        html = _email_wrapper(header, content, footer)
        _send_via_resend(to_email=to_email, subject=f"[{tenant_name}] {subject}", html=html)
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        logger.error(f"send_broadcast_email falhou para {to_email}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3, ignore_result=True)
def send_password_reset_email(self, to_email, to_name, reset_url, tenant_name,
                               logo_url="", primary_color="#4F46E5"):
    try:
        header = _email_header(tenant_name, logo_url, primary_color)
        content = (
            f'<div style="padding:32px;">'
            f'<h2 style="margin:0 0 8px;font-size:22px;color:#111827;">Redefinição de senha</h2>'
            f'<p style="margin:0 0 24px;color:#6B7280;font-size:14px;">Recebemos uma solicitação para redefinir a senha da sua conta.</p>'
            f'<p style="margin:0 0 24px;color:#374151;font-size:15px;">Olá <strong>{to_name}</strong>,</p>'
            f'<p style="margin:0 0 24px;color:#4B5563;font-size:15px;">Clique no botão abaixo para criar uma nova senha:</p>'
            f'<div style="text-align:center;margin:32px 0;">'
            f'<a href="{reset_url}" style="display:inline-block;background:{primary_color};color:#FFFFFF;'
            f'padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;'
            f'letter-spacing:0.3px;">Redefinir senha</a>'
            f'</div>'
            f'<div style="background:#F9FAFB;border-radius:8px;padding:16px;margin-top:24px;">'
            f'<p style="margin:0;color:#6B7280;font-size:12px;line-height:1.5;">'
            f'Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição, '
            f'ignore este e-mail — sua senha permanece a mesma.'
            f'</p>'
            f'</div>'
            f'</div>'
        )
        footer = _email_footer(tenant_name)
        html = _email_wrapper(header, content, footer)
        _send_via_resend(
            to_email=to_email,
            subject=f"[{tenant_name}] Redefinição de senha",
            html=html,
        )
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        logger.error(f"send_password_reset_email falhou para {to_email}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3, ignore_result=True)
def send_welcome_email(self, to_email, to_name, password, tenant_name, platform_url,
                       support_email="", logo_url="", primary_color="#4F46E5",
                       course_names=None):
    try:
        header = _email_header(tenant_name, logo_url, primary_color)
        support_line = (
            f'<p style="margin:12px 0 0;color:#6B7280;font-size:12px;">'
            f'Dúvidas? Entre em contato: <a href="mailto:{support_email}" style="color:{primary_color};">'
            f'{support_email}</a></p>'
        ) if support_email else ""

        # Bloco de cursos matriculados
        courses_block = ""
        if course_names:
            course_items = "".join(
                f'<tr><td style="padding:4px 0;">'
                f'<span style="display:inline-block;background:{primary_color}1A;color:{primary_color};'
                f'padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600;">📚 {c}</span>'
                f'</td></tr>'
                for c in course_names
            )
            courses_block = (
                f'<div style="margin-bottom:28px;">'
                f'<p style="margin:0 0 10px;color:#374151;font-size:14px;font-weight:600;">Você foi matriculado em:</p>'
                f'<table width="100%" cellpadding="0" cellspacing="0">{course_items}</table>'
                f'</div>'
            )

        content = (
            f'<div style="padding:40px 32px 32px;text-align:center;">'
            f'<h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;letter-spacing:-0.5px;">Bem-vindo(a)! 🎓</h2>'
            f'<p style="margin:0 0 32px;color:#6B7280;font-size:15px;line-height:1.6;">Sua conta na <strong>{tenant_name}</strong> foi criada.</p>'
            f'<p style="margin:0 0 20px;color:#374151;font-size:16px;line-height:1.5;text-align:left;">Olá <strong>{to_name}</strong>,</p>'
            f'{courses_block}'
            f'<p style="margin:0 0 20px;color:#4B5563;font-size:15px;line-height:1.5;text-align:left;">'
            f'Suas credenciais de acesso:</p>'
            f'<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:20px;margin-bottom:28px;text-align:left;">'
            f'<table width="100%" cellpadding="0" cellspacing="0">'
            f'<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:80px;">E-mail</td>'
            f'<td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">{to_email}</td></tr>'
            f'<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Senha</td>'
            f'<td style="padding:6px 0;">'
            f'<code style="background:#E5E7EB;padding:3px 10px;border-radius:4px;font-size:14px;color:#111827;">'
            f'{password}</code></td></tr>'
            f'</table>'
            f'</div>'
            f'<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">'
            f'<tr><td align="center">'
            f'<table role="presentation" border="0" cellspacing="0" cellpadding="0">'
            f'<tr><td align="center" bgcolor="{primary_color}" style="border-radius:8px;">'
            f'<a href="{platform_url}" target="_blank" style="display:inline-block;padding:14px 32px;'
            f'font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;color:#FFFFFF;'
            f'text-decoration:none;font-weight:700;border-radius:8px;">Acessar a plataforma →</a>'
            f'</td></tr></table>'
            f'</td></tr></table>'
            f'<div style="background:#F9FAFB;border-radius:8px;padding:16px 24px;margin-top:28px;text-align:left;">'
            f'<p style="margin:0;color:#6B7280;font-size:13px;line-height:1.6;">'
            f'💡 Você pode alterar sua senha a qualquer momento nas configurações do seu perfil. '
            f'Não é obrigatório, mas recomendamos criar uma senha pessoal.'
            f'</p>'
            f'</div>'
            f'{support_line}'
            f'</div>'
        )
        footer = _email_footer(tenant_name)
        html = _email_wrapper(header, content, footer)
        _send_via_resend(
            to_email=to_email,
            subject=f"[{tenant_name}] Bem-vindo(a) à plataforma!",
            html=html,
        )
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        logger.error(f"send_welcome_email falhou para {to_email}: {exc}")
        raise self.retry(exc=exc, countdown=60)


# ══════════════════════════════════════════════════════════════════════════════
# GAMIFICAÇÃO
# ══════════════════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, max_retries=2)
def update_gamification_after_answer(self, user_id, tenant_id, is_correct, xp_gained):
    try:
        from app.extensions import db
        from app.models.gamification import UserPoints
        from app.services.badge_engine import BadgeEngine
        user_points = UserPoints.query.filter_by(user_id=user_id, tenant_id=tenant_id).first()
        if user_points:
            user_points.total_points += xp_gained
            user_points.questions_answered += 1
            if is_correct: user_points.questions_correct += 1
            db.session.commit()
            BadgeEngine(user_id, tenant_id).check_and_award()
        return {"status": "ok", "xp": xp_gained}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE GEMINI — ANÁLISE DE QUESTÕES
# ══════════════════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, max_retries=2, name="tasks.analyze_question_task")
def analyze_question_task(self, question_id, tenant_id):
    import logging
    logger = logging.getLogger(__name__)
    try:
        from app.extensions import db
        from app.models.question import Question, QuestionSourceType
        question = (
            Question.query
            .filter(
                Question.id == question_id,
                # filter_by(tenant_id=None) gera "= NULL" — nunca funciona
                # .is_(None) gera corretamente "IS NULL"
                Question.tenant_id.is_(None) if tenant_id is None
                else (Question.tenant_id == tenant_id),
                Question.is_deleted == False,
                Question.source_type == QuestionSourceType.BANK,
            )
            .first()
        )
        if not question:
            logger.warning(
                f"analyze_question_task: questão {question_id} não encontrada "
                f"(tenant_id={'NULL' if tenant_id is None else tenant_id})"
            )
            return {"status": "skipped", "reason": "not_found_or_wrong_type"}
        from app.services.gemini_service import GeminiService
        svc = GeminiService()
        alternatives_text = "\n".join(f"{alt.key}) {alt.text}" for alt in sorted(question.alternatives, key=lambda a: a.key))
        analysis = svc.analyze_question_metadata(statement=question.statement, alternatives_text=alternatives_text,
                                                  correct_key=question.correct_alternative_key, exam_board=question.exam_board or "")
        if not analysis:
            return {"status": "failed", "reason": "gemini_no_response"}
        if not question.discipline and analysis.get("discipline"): question.discipline = analysis["discipline"]
        if not question.topic and analysis.get("topic"): question.topic = analysis["topic"]
        if not question.subtopic and analysis.get("subtopic"): question.subtopic = analysis["subtopic"]
        if not question.competency and analysis.get("competency"): question.competency = analysis["competency"]
        if analysis.get("difficulty") and question.difficulty.value == "medium":
            from app.models.question import DifficultyLevel
            try: question.difficulty = DifficultyLevel(analysis["difficulty"])
            except ValueError: pass
        if analysis.get("distractor_justifications"):
            justifications = analysis["distractor_justifications"]
            for alt in question.alternatives:
                if not alt.distractor_justification and alt.key != question.correct_alternative_key:
                    alt.distractor_justification = justifications.get(alt.key)
        if not question.correct_justification and analysis.get("correct_justification"):
            question.correct_justification = analysis["correct_justification"]
        db.session.commit()
        return {"status": "ok", "question_id": question_id}
    except Exception as exc:
        logger.error(f"analyze_question_task error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE GEMINI — GERAÇÃO DE QUESTÕES DAS AULAS
# ══════════════════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, max_retries=2, name="tasks.generate_lesson_questions_task")
def generate_lesson_questions_task(self, lesson_id, tenant_id, count=5, difficulty="medium"):
    import logging
    logger = logging.getLogger(__name__)
    try:
        from app.extensions import db
        from app.models.course import Lesson
        from app.models.question import Question, Alternative, QuestionSourceType, DifficultyLevel
        lesson = Lesson.query.filter_by(id=lesson_id, tenant_id=tenant_id, is_deleted=False).first()
        if not lesson:
            return {"status": "skipped", "reason": "lesson_not_found"}
        from app.services.gemini_service import GeminiService
        svc = GeminiService()
        is_youtube = lesson.video_url and ("youtube.com" in lesson.video_url or "youtu.be" in lesson.video_url)
        source_used = "youtube_native" if is_youtube else "context"
        context_parts = [f"Título da aula: {lesson.title}"]
        if lesson.description: context_parts.append(f"Descrição: {lesson.description}")
        if lesson.ai_summary: context_parts.append(f"Resumo: {lesson.ai_summary}")
        if lesson.ai_topics: context_parts.append(f"Tópicos abordados: {', '.join(lesson.ai_topics)}")
        lesson_context = "\n\n".join(context_parts)
        questions_data = svc.generate_lesson_questions(lesson_context=lesson_context, lesson_title=lesson.title,
                                                        count=count, difficulty=difficulty, video_url=lesson.video_url)
        if not questions_data:
            return {"status": "failed", "reason": "gemini_no_questions"}
        created = 0
        for q_data in questions_data:
            if not q_data.get("statement") or not q_data.get("alternatives"): continue
            if len(q_data["alternatives"]) < 2: continue
            if not q_data.get("correct_alternative_key"): continue
            try: diff_level = DifficultyLevel(q_data.get("difficulty", difficulty))
            except ValueError: diff_level = DifficultyLevel(difficulty)
            question = Question(tenant_id=tenant_id, source_type=QuestionSourceType.LESSON, lesson_id=lesson_id,
                                subject_id=None, statement=q_data["statement"], context=q_data.get("context"),
                                discipline=q_data.get("discipline") or lesson.title, topic=q_data.get("topic"),
                                difficulty=diff_level, correct_alternative_key=q_data["correct_alternative_key"].lower(),
                                correct_justification=q_data.get("correct_justification"), is_active=True, is_reviewed=False)
            db.session.add(question)
            db.session.flush()
            for alt_data in q_data["alternatives"]:
                if not alt_data.get("key") or not alt_data.get("text"): continue
                db.session.add(Alternative(tenant_id=tenant_id, question_id=question.id, key=alt_data["key"].lower(),
                                           text=alt_data["text"], distractor_justification=alt_data.get("distractor_justification")))
            created += 1
        db.session.commit()
        return {"status": "ok", "lesson_id": lesson_id, "questions_created": created, "source_used": source_used}
    except Exception as exc:
        logger.error(f"generate_lesson_questions_task error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=90)


# ══════════════════════════════════════════════════════════════════════════════
# INSIGHTS — REGENERAÇÃO POR TENANT
# ══════════════════════════════════════════════════════════════════════════════

@celery_app.task(name="app.tasks.regenerate_tenant_insights")
def regenerate_tenant_insights(tenant_id: str):
    """
    Regenera os insights de todos os alunos de um tenant via Gemini.
    Chamado imediatamente quando o produtor muda o insight_theme.
    O ContextTask do __init__.py já injeta o app_context.
    """
    import logging
    from datetime import datetime, timezone, timedelta
    from app.models.user import User, UserRole
    from app.models.tenant import Tenant
    from app.routes.analytics import (
        _get_questions_stats, _get_discipline_stats, _get_lesson_progress_stats,
        _get_time_stats, _generate_insights, _set_cached_insights, _delete_cached_insights,
    )

    logger = logging.getLogger(__name__)

    tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
    if not tenant:
        logger.warning(f"regenerate_tenant_insights: tenant {tenant_id} não encontrado.")
        return

    students = User.query.filter_by(
        tenant_id=tenant_id, role=UserRole.STUDENT.value, is_active=True, is_deleted=False
    ).all()

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    success = 0
    for student in students:
        try:
            _delete_cached_insights(student.id, tenant_id)
            questions_stats = _get_questions_stats(student.id, tenant_id, today_start, week_start)
            discipline_stats = _get_discipline_stats(student.id, tenant_id)
            lesson_progress = _get_lesson_progress_stats(student.id, tenant_id)
            time_stats = _get_time_stats(student.id, tenant_id, today_start, week_start)
            insights = _generate_insights(user=student, tenant=tenant, questions_stats=questions_stats,
                                          discipline_stats=discipline_stats, lesson_progress=lesson_progress, time_stats=time_stats)
            _set_cached_insights(student.id, tenant_id, insights)
            success += 1
        except Exception as e:
            logger.warning(f"regenerate_tenant_insights: falha no aluno {student.id}: {e}")
            continue

    logger.info(f"regenerate_tenant_insights: tenant {tenant_id} — {success}/{len(students)} alunos atualizados.")
    return {"status": "ok", "updated": success, "total": len(students)}


@celery_app.task(name="app.tasks.scheduled_insights_refresh")
def scheduled_insights_refresh():
    """
    Celery Beat: roda a cada 2h.
    Regenera insights de todos os tenants ativos, exceto entre 00h-07h BRT.
    BRT = UTC-3, logo 00h-07h BRT = 03h-10h UTC.
    """
    import logging
    from datetime import datetime, timezone
    from app.models.tenant import Tenant

    logger = logging.getLogger(__name__)
    now_utc = datetime.now(timezone.utc)

    # Silêncio noturno: 03h-10h UTC = 00h-07h BRT
    if 3 <= now_utc.hour < 10:
        logger.info("scheduled_insights_refresh: período de silêncio (00h-07h BRT). Pulando.")
        return {"status": "skipped", "reason": "silence_window"}

    tenants = Tenant.query.filter_by(is_active=True, is_deleted=False).all()
    for tenant in tenants:
        regenerate_tenant_insights.delay(tenant.id)

    logger.info(f"scheduled_insights_refresh: {len(tenants)} tenant(s) enfileirados.")
    return {"status": "ok", "tenants_queued": len(tenants)}

# ══════════════════════════════════════════════════════════════════════════════
# XLSX IMPORT JOB — processamento assíncrono de planilhas de questões
# ══════════════════════════════════════════════════════════════════════════════


@celery_app.task(
    name="app.tasks.process_xlsx_import_job",
    bind=True,
    max_retries=0,
)
def process_xlsx_import_job(self, job_id: str):
    """
    Processa importação de questões a partir de xlsx/zip salvo no S3.
    Estado mantido no Redis. Checa cancelamento a cada 10 linhas.
    """
    import json
    import logging
    import zipfile
    from datetime import datetime

    logger = logging.getLogger(__name__)

    from app.routes.admin.questions import (
        _job_get, _job_set, _job_is_cancelled,
        _download_file_from_s3_temp, _delete_s3_temp,
        _extract_zip, _parse_xlsx_sheets, _insert_or_update_question,
    )
    from app.extensions import db

    logger.info(f"[xlsx_import_job] Iniciando job {job_id}")

    job = _job_get(job_id)
    if not job:
        logger.error(f"[xlsx_import_job] Job {job_id} não encontrado no Redis")
        return

    job["status"] = "running"
    _job_set(job_id, job)

    s3_key = job.get("s3_key")
    s3_ext = job.get("s3_ext", "xlsx")
    enrich_ai = job.get("enrich_ai", True)

    file_bytes = _download_file_from_s3_temp(s3_key)
    if not file_bytes:
        job["status"] = "error"
        job["finished_at"] = datetime.utcnow().isoformat()
        job["error_details"].append({"error": "Arquivo não encontrado no S3"})
        _job_set(job_id, job)
        return

    image_map: dict[str, bytes] = {}
    if s3_ext == "zip":
        try:
            xlsx_bytes, image_map = _extract_zip(file_bytes)
        except zipfile.BadZipFile:
            job["status"] = "error"
            job["finished_at"] = datetime.utcnow().isoformat()
            job["error_details"].append({"error": "Arquivo zip corrompido"})
            _job_set(job_id, job)
            _delete_s3_temp(s3_key)
            return
    else:
        xlsx_bytes = file_bytes

    try:
        rows = _parse_xlsx_sheets(xlsx_bytes)
    except Exception as e:
        job["status"] = "error"
        job["finished_at"] = datetime.utcnow().isoformat()
        job["error_details"].append({"error": f"Erro ao ler xlsx: {str(e)}"})
        _job_set(job_id, job)
        _delete_s3_temp(s3_key)
        return

    job["total"] = len(rows)
    _job_set(job_id, job)

    for i, row in enumerate(rows):
        if i % 10 == 0 and _job_is_cancelled(job_id):
            logger.info(f"[xlsx_import_job] Job {job_id} cancelado na linha {i}")
            job["status"] = "cancelled"
            job["finished_at"] = datetime.utcnow().isoformat()
            _job_set(job_id, job)
            _delete_s3_temp(s3_key)
            db.session.rollback()
            return

        try:
            status, img_uploaded = _insert_or_update_question(row, image_map, enrich_ai)
            if status == "inserted":
                job["inserted"] += 1
            elif status == "updated":
                job["updated"] += 1
            elif status == "skipped":
                job["skipped"] += 1
            elif status.startswith("error:"):
                job["errors"] += 1
                if len(job["error_details"]) < 50:
                    job["error_details"].append({
                        "row": row.get("_row"),
                        "sheet": row.get("_sheet"),
                        "statement_preview": (row.get("statement") or "")[:60],
                        "error": status[6:],
                    })
            if img_uploaded:
                job["images_uploaded"] += 1
            if (job["inserted"] + job["updated"]) % 50 == 0:
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            job["errors"] += 1
            if len(job["error_details"]) < 50:
                job["error_details"].append({
                    "row": row.get("_row"),
                    "sheet": row.get("_sheet"),
                    "statement_preview": (row.get("statement") or "")[:60],
                    "error": str(e),
                })

        job["processed"] = i + 1
        if i % 10 == 0:
            _job_set(job_id, job)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"[xlsx_import_job] Commit final falhou: {e}")

    job["status"] = "done"
    job["finished_at"] = datetime.utcnow().isoformat()
    _job_set(job_id, job)
    _delete_s3_temp(s3_key)

    logger.info(
        f"[xlsx_import_job] Job {job_id} concluído: "
        f"inserted={job['inserted']} updated={job['updated']} "
        f"skipped={job['skipped']} errors={job['errors']}"
    )
    return {
        "status": "done",
        "inserted": job["inserted"],
        "updated": job["updated"],
        "skipped": job["skipped"],
        "errors": job["errors"],
    }

# ══════════════════════════════════════════════════════════════════════════════
# REPROCESS GEMINI JOB — enriquecimento assíncrono com progresso no Redis
# ══════════════════════════════════════════════════════════════════════════════


@celery_app.task(
    name="app.tasks.run_reprocess_gemini_job",
    bind=True,
    max_retries=0,
)
def run_reprocess_gemini_job(self, job_id: str, limit: int = 9999):
    """
    Processa questões pendentes de enriquecimento Gemini uma a uma.

    Fluxo:
      1. Lê job_id do Redis
      2. Busca questões com tip=NULL no banco
      3. Para cada questão: chama analyze_question_task de forma síncrona
         (não dispara subtask — controla o progresso diretamente)
      4. Atualiza Redis a cada 5 questões
      5. Checa cancelamento a cada 5 questões
    """
    import logging
    from datetime import datetime
    from sqlalchemy import and_

    logger = logging.getLogger(__name__)

    from app.routes.admin.questions import (
        _reprocess_job_get, _reprocess_job_set, _reprocess_job_is_cancelled,
    )
    from app.extensions import db
    from app.models.question import Question, QuestionSourceType, ReviewStatus
    from app.services.gemini_service import GeminiService

    logger.info(f"[reprocess_gemini_job] Iniciando job {job_id}")

    job = _reprocess_job_get(job_id)
    if not job:
        logger.error(f"[reprocess_gemini_job] Job {job_id} não encontrado")
        return

    job["status"] = "running"
    _reprocess_job_set(job_id, job)

    # Busca todas as questões pendentes de uma vez (IDs apenas para não travar memória)
    pending_ids = [
        r[0] for r in db.session.query(Question.id)
        .filter(
            Question.source_type == QuestionSourceType.BANK,
            Question.tenant_id.is_(None),
            Question.review_status == ReviewStatus.APPROVED,
            Question.is_active == True,
            Question.tip.is_(None),
        )
        .limit(limit)
        .all()
    ]

    job["total"] = len(pending_ids)
    _reprocess_job_set(job_id, job)

    svc = GeminiService()

    for i, question_id in enumerate(pending_ids):
        # Checa cancelamento a cada 5 questões
        if i % 5 == 0 and _reprocess_job_is_cancelled(job_id):
            logger.info(f"[reprocess_gemini_job] Cancelado na questão {i}")
            job["status"] = "cancelled"
            job["finished_at"] = datetime.utcnow().isoformat()
            _reprocess_job_set(job_id, job)
            return

        try:
            question = db.session.get(Question, question_id)
            if not question:
                job["skipped"] += 1
                continue

            # Chama Gemini diretamente (síncrono para controlar progresso)
            alternatives_text = "\n".join(
                f"{alt.key}) {alt.text}"
                for alt in sorted(question.alternatives, key=lambda a: a.key)
            )
            analysis = svc.analyze_question_metadata(
                statement=question.statement,
                alternatives_text=alternatives_text,
                correct_key=question.correct_alternative_key,
                exam_board=question.exam_board or "",
            )

            if not analysis:
                job["errors"] += 1
                if len(job["error_details"]) < 30:
                    job["error_details"].append({
                        "question_id": question_id,
                        "error": "Gemini não retornou análise",
                    })
                continue

            # Aplica análise
            if not question.discipline and analysis.get("discipline"):
                question.discipline = analysis["discipline"]
            if not question.topic and analysis.get("topic"):
                question.topic = analysis["topic"]
            if not question.subtopic and analysis.get("subtopic"):
                question.subtopic = analysis["subtopic"]
            if not question.tip and analysis.get("tip"):
                question.tip = analysis["tip"]
            if not question.correct_justification and analysis.get("correct_justification"):
                question.correct_justification = analysis["correct_justification"]
            if analysis.get("distractor_justifications"):
                justifications = analysis["distractor_justifications"]
                for alt in question.alternatives:
                    if not alt.distractor_justification and alt.key != question.correct_alternative_key:
                        alt.distractor_justification = justifications.get(alt.key) or justifications.get(alt.key.upper())

            # Marca como enriquecida (se a coluna existir)
            try:
                question.gemini_enriched = True
            except Exception:
                pass  # Coluna ainda não migrada — ignora

            db.session.commit()
            job["enriched"] += 1

        except Exception as e:
            db.session.rollback()
            job["errors"] += 1
            if len(job["error_details"]) < 30:
                job["error_details"].append({
                    "question_id": question_id,
                    "error": str(e)[:120],
                })
            logger.warning(f"[reprocess_gemini_job] Erro na questão {question_id}: {e}")

        job["processed"] = i + 1

        # Atualiza Redis a cada 5 questões
        if i % 5 == 0:
            _reprocess_job_set(job_id, job)

    job["status"] = "done"
    job["finished_at"] = datetime.utcnow().isoformat()
    _reprocess_job_set(job_id, job)

    logger.info(
        f"[reprocess_gemini_job] Job {job_id} concluído: "
        f"enriched={job['enriched']} skipped={job['skipped']} errors={job['errors']}"
    )
    return {
        "status": "done",
        "enriched": job["enriched"],
        "skipped": job["skipped"],
        "errors": job["errors"],
    }