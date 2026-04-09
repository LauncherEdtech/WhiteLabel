# api/app/tasks.py
from app.extensions import celery_app
from flask_mail import Message


# ══════════════════════════════════════════════════════════════════════════════
# E-MAIL TASKS
# ══════════════════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, max_retries=3)
def send_broadcast_email(self, to_email, to_name, subject, body, tenant_name):
    try:
        from app.extensions import mail
        msg = Message(subject=f"[{tenant_name}] {subject}", recipients=[to_email],
                      body=f"Olá {to_name},\n\n{body}\n\nAtenciosamente,\n{tenant_name}",
                      html=f'<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#4F46E5">{tenant_name}</h2><p>Olá <strong>{to_name}</strong>,</p><p>{body}</p><hr><p style="color:#666;font-size:12px">Você recebeu este e-mail pois é aluno da plataforma {tenant_name}.</p></div>')
        mail.send(msg)
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3)
def send_password_reset_email(self, to_email, to_name, reset_url, tenant_name):
    try:
        from app.extensions import mail
        msg = Message(subject=f"[{tenant_name}] Redefinição de senha", recipients=[to_email],
                      html=f'<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#4F46E5">{tenant_name}</h2><p>Olá <strong>{to_name}</strong>,</p><p>Clique no botão abaixo para redefinir sua senha:</p><a href="{reset_url}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Redefinir senha</a><p style="color:#666;font-size:12px">Este link expira em 1 hora. Se você não solicitou, ignore este e-mail.</p></div>')
        mail.send(msg)
        return {"status": "sent", "to": to_email}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=3)
def send_welcome_email(self, to_email, to_name, password, tenant_name, platform_url, support_email=""):
    try:
        from app.extensions import mail
        msg = Message(subject=f"[{tenant_name}] Seu acesso à plataforma", recipients=[to_email],
                      body=f"Olá {to_name},\n\nSeu acesso à plataforma {tenant_name} foi criado!\n\nE-mail: {to_email}\nSenha: {password}\n\nAcesse agora: {platform_url}\n\nAtenciosamente,\n{tenant_name}",
                      html=f"""<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:32px"><div style="background:white;border-radius:12px;padding:32px"><h2 style="color:#4F46E5;margin:0 0 8px">Bem-vindo(a) à {tenant_name}! 🎓</h2><p style="color:#6B7280;margin:0 0 24px">Sua conta foi criada. Confira suas credenciais:</p><div style="background:#F3F4F6;border-radius:8px;padding:20px;margin-bottom:24px"><p style="margin:0 0 8px;color:#374151;font-size:14px"><strong>E-mail:</strong> {to_email}</p><p style="margin:0;color:#374151;font-size:14px"><strong>Senha:</strong> <span style="background:#E5E7EB;padding:2px 8px;border-radius:4px;font-family:monospace">{password}</span></p></div><a href="{platform_url}" style="display:inline-block;background:#4F46E5;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;margin-bottom:24px">Acessar a plataforma →</a><p style="color:#9CA3AF;font-size:12px;margin:0">Recomendamos alterar sua senha após o primeiro acesso.{"<br>Dúvidas? Entre em contato: " + support_email if support_email else ""}</p></div></div>""")
        mail.send(msg)
        return {"status": "sent", "to": to_email}
    except Exception as exc:
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
        question = Question.query.filter_by(id=question_id, tenant_id=tenant_id, is_deleted=False, source_type=QuestionSourceType.BANK).first()
        if not question:
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