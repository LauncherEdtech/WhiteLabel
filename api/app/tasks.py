# api/app/tasks.py
from app.extensions import celery_app
from flask_mail import Message


# ══════════════════════════════════════════════════════════════════════════════
# E-MAIL TASKS
# ══════════════════════════════════════════════════════════════════════════════


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


# ══════════════════════════════════════════════════════════════════════════════
# GAMIFICAÇÃO
# ══════════════════════════════════════════════════════════════════════════════


@celery_app.task(bind=True, max_retries=2)
def update_gamification_after_answer(
    self, user_id: str, tenant_id: str, is_correct: bool, xp_gained: int
):
    """
    Atualiza XP e verifica desbloqueio de badges após o aluno responder uma questão.
    Executado de forma assíncrona para não bloquear a resposta do endpoint.
    """
    try:
        from app.extensions import db
        from app.models.gamification import UserPoints
        from app.services.badge_engine import BadgeEngine

        # Atualiza pontos
        user_points = UserPoints.query.filter_by(
            user_id=user_id, tenant_id=tenant_id
        ).first()
        if user_points:
            user_points.total_points += xp_gained
            user_points.questions_answered += 1
            if is_correct:
                user_points.questions_correct += 1
            db.session.commit()

            # Verifica badges
            engine = BadgeEngine(user_id, tenant_id)
            engine.check_and_award()

        return {"status": "ok", "xp": xp_gained}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE GEMINI — ANÁLISE DE QUESTÕES DO BANCO (source_type="bank")
# ══════════════════════════════════════════════════════════════════════════════


@celery_app.task(bind=True, max_retries=2, name="tasks.analyze_question_task")
def analyze_question_task(self, question_id: str, tenant_id: str):
    """
    Analisa uma questão do banco via Gemini e preenche metadados faltantes.

    Disparado automaticamente quando o produtor cria uma questão sem:
    - discipline (disciplina)
    - topic (tópico)

    Preenche: discipline, topic, subtopic, difficulty, competency.
    Marca is_reviewed=False para indicar que foi preenchido por IA (não por humano).

    NÃO processa questões source_type="lesson" — estas já vêm com contexto
    da aula e são geradas pelo generate_lesson_questions_task.
    """
    import logging

    logger = logging.getLogger(__name__)

    try:
        from app.extensions import db
        from app.models.question import Question, QuestionSourceType

        question = Question.query.filter_by(
            id=question_id,
            tenant_id=tenant_id,
            is_deleted=False,
            source_type=QuestionSourceType.BANK,  # só analisa questões do banco
        ).first()

        if not question:
            logger.warning(
                f"analyze_question_task: questão {question_id} não encontrada ou não é do banco."
            )
            return {"status": "skipped", "reason": "not_found_or_wrong_type"}

        from app.services.gemini_service import GeminiService

        svc = GeminiService()

        # Monta contexto com o que já temos
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
            logger.warning(
                f"analyze_question_task: Gemini não retornou análise para {question_id}."
            )
            return {"status": "failed", "reason": "gemini_no_response"}

        # Preenche apenas campos que estão vazios — não sobrescreve o que o produtor já preencheu
        if not question.discipline and analysis.get("discipline"):
            question.discipline = analysis["discipline"]

        if not question.topic and analysis.get("topic"):
            question.topic = analysis["topic"]

        if not question.subtopic and analysis.get("subtopic"):
            question.subtopic = analysis["subtopic"]

        if not question.competency and analysis.get("competency"):
            question.competency = analysis["competency"]

        # Dificuldade: atualiza se Gemini discordar (mas mantém a do produtor se ele preencheu)
        if analysis.get("difficulty") and question.difficulty.value == "medium":
            from app.models.question import DifficultyLevel

            try:
                question.difficulty = DifficultyLevel(analysis["difficulty"])
            except ValueError:
                pass

        # Justificativas dos distratores: preenche se estiverem vazias
        if analysis.get("distractor_justifications"):
            justifications = analysis["distractor_justifications"]
            for alt in question.alternatives:
                if (
                    not alt.distractor_justification
                    and alt.key != question.correct_alternative_key
                ):
                    alt.distractor_justification = justifications.get(alt.key)

        if not question.correct_justification and analysis.get("correct_justification"):
            question.correct_justification = analysis["correct_justification"]

        # Mantém is_reviewed=False — indica que foi preenchido por IA, não revisado por humano
        db.session.commit()

        logger.info(
            f"analyze_question_task: questão {question_id} analisada com sucesso."
        )
        return {
            "status": "ok",
            "question_id": question_id,
            "filled": {
                "discipline": analysis.get("discipline"),
                "topic": analysis.get("topic"),
                "difficulty": analysis.get("difficulty"),
            },
        }

    except Exception as exc:
        logger.error(f"analyze_question_task error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60)


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE GEMINI — GERAÇÃO DE QUESTÕES DAS AULAS (source_type="lesson")
# ══════════════════════════════════════════════════════════════════════════════


@celery_app.task(bind=True, max_retries=2, name="tasks.generate_lesson_questions_task")
def generate_lesson_questions_task(
    self,
    lesson_id: str,
    tenant_id: str,
    count: int = 5,
    difficulty: str = "medium",
):
    """
    Gera questões para uma aula específica via Gemini.

    Questões geradas são source_type="lesson" e lesson_id=lesson_id.
    - NUNCA aparecem no banco geral (GET /questions/)
    - NUNCA entram em simulados automáticos
    - Ficam em GET /lessons/:id/questions
    - is_reviewed=False por padrão — produtor precisa aprovar antes dos alunos verem

    Usa como contexto: title, description, ai_summary, ai_topics da aula.
    """
    import logging

    logger = logging.getLogger(__name__)

    try:
        from app.extensions import db
        from app.models.course import Lesson
        from app.models.question import (
            Question,
            Alternative,
            QuestionSourceType,
            DifficultyLevel,
        )

        lesson = Lesson.query.filter_by(
            id=lesson_id,
            tenant_id=tenant_id,
            is_deleted=False,
        ).first()

        if not lesson:
            logger.warning(
                f"generate_lesson_questions_task: aula {lesson_id} não encontrada."
            )
            return {"status": "skipped", "reason": "lesson_not_found"}

        # Monta contexto rico da aula para o Gemini
        context_parts = [f"Título da aula: {lesson.title}"]

        if lesson.description:
            context_parts.append(f"Descrição: {lesson.description}")

        if lesson.ai_summary:
            context_parts.append(f"Resumo: {lesson.ai_summary}")

        if lesson.ai_topics and len(lesson.ai_topics) > 0:
            topics_str = ", ".join(lesson.ai_topics)
            context_parts.append(f"Tópicos abordados: {topics_str}")

        lesson_context = "\n\n".join(context_parts)

        if len(lesson_context.strip()) < 30:
            logger.warning(
                f"generate_lesson_questions_task: aula {lesson_id} sem conteúdo suficiente."
            )
            return {"status": "skipped", "reason": "insufficient_content"}

        from app.services.gemini_service import GeminiService

        svc = GeminiService()

        # Gera questões específicas para o conteúdo da aula
        questions_data = svc.generate_lesson_questions(
            lesson_context=lesson_context,
            lesson_title=lesson.title,
            count=count,
            difficulty=difficulty,
        )

        if not questions_data:
            logger.warning(
                f"generate_lesson_questions_task: Gemini não gerou questões para aula {lesson_id}."
            )
            return {"status": "failed", "reason": "gemini_no_questions"}

        created = 0
        for q_data in questions_data:
            # Valida estrutura mínima
            if not q_data.get("statement") or not q_data.get("alternatives"):
                continue
            if len(q_data["alternatives"]) < 2:
                continue
            if not q_data.get("correct_alternative_key"):
                continue

            # Detecta dificuldade do dado retornado
            diff_raw = q_data.get("difficulty", difficulty)
            try:
                diff_level = DifficultyLevel(diff_raw)
            except ValueError:
                diff_level = DifficultyLevel(difficulty)

            question = Question(
                tenant_id=tenant_id,
                source_type=QuestionSourceType.LESSON,  # ← SEMPRE lesson para questões de aula
                lesson_id=lesson_id,  # ← VINCULADA à aula
                subject_id=None,  # ← não associa a disciplina do banco
                statement=q_data["statement"],
                context=q_data.get("context"),
                discipline=q_data.get("discipline") or lesson.title,
                topic=q_data.get("topic"),
                difficulty=diff_level,
                correct_alternative_key=q_data["correct_alternative_key"].lower(),
                correct_justification=q_data.get("correct_justification"),
                is_active=True,
                is_reviewed=False,  # ← produtor precisa revisar antes de publicar aos alunos
            )
            db.session.add(question)
            db.session.flush()

            for alt_data in q_data["alternatives"]:
                if not alt_data.get("key") or not alt_data.get("text"):
                    continue
                alt = Alternative(
                    tenant_id=tenant_id,
                    question_id=question.id,
                    key=alt_data["key"].lower(),
                    text=alt_data["text"],
                    distractor_justification=alt_data.get("distractor_justification"),
                )
                db.session.add(alt)

            created += 1

        db.session.commit()

        logger.info(
            f"generate_lesson_questions_task: {created} questão(ões) gerada(s) para aula {lesson_id}."
        )
        return {
            "status": "ok",
            "lesson_id": lesson_id,
            "questions_created": created,
        }

    except Exception as exc:
        logger.error(f"generate_lesson_questions_task error: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=90)
