# api/app/services/gemini_service.py
"""
Serviço de integração com Google Gemini API.

Pipeline de geração de questões:
1. Se video_url YouTube → passa URL diretamente ao Gemini via file_data
   (Gemini busca o vídeo nos servidores do Google — sem bloqueio de IP AWS)
2. Fallback → usa title + description + ai_summary + ai_topics
"""

import os
import re
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_GEMINI_AVAILABLE = False
try:
    from google import genai
    from google.genai import types as genai_types

    _GEMINI_AVAILABLE = bool(os.environ.get("GEMINI_API_KEY"))
    if _GEMINI_AVAILABLE:
        logger.info("Gemini API configurada com sucesso.")
except ImportError:
    logger.warning("google-generativeai não instalado. Usando fallback.")


def _get_client():
    """Retorna cliente Gemini configurado com a API key."""
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


# Modelo estável com suporte nativo a YouTube URL e contexto de 1M tokens
MODEL = "gemini-2.5-flash-lite"


class GeminiService:

    def _call(self, prompt: str, max_tokens: int = 6144) -> Optional[str]:
        """Chamada simples de texto ao Gemini."""
        if not _GEMINI_AVAILABLE:
            return None
        try:
            client = _get_client()
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    max_output_tokens=max_tokens,
                    temperature=0.3,
                ),
            )
            return response.text
        except Exception as e:
            logger.error(f"Erro Gemini (_call): {e}")
            return None

    def _call_with_video(self, video_url: str, prompt: str, max_tokens: int = 8192) -> Optional[str]:
        if not _GEMINI_AVAILABLE:
            logger.error("GEMINI INDISPONÍVEL — verifique GEMINI_API_KEY e pacote google-genai")
            return None
        logger.info(f"Gemini video: url={video_url[:60]} modelo={MODEL}")
        try:
            client = _get_client()
            response = client.models.generate_content(
                model=MODEL,
                contents=genai_types.Content(
                    parts=[
                        genai_types.Part(file_data=genai_types.FileData(file_uri=video_url)),
                        genai_types.Part(text=prompt),
                    ]
                ),
                config=genai_types.GenerateContentConfig(
                    max_output_tokens=max_tokens,
                    temperature=0.3,
                ),
            )
            logger.info(f"Gemini respondeu: {len(response.text)} chars")
            return response.text
        except Exception as e:
            logger.error(f"Erro Gemini _call_with_video: {type(e).__name__}: {e}")
            return None


    def _parse_json(self, text: str) -> Optional[dict | list]:
        """Extrai JSON de uma resposta do Gemini."""
        if not text:
            return None
        try:
            clean = re.sub(r"```(?:json)?\n?", "", text).strip().rstrip("`").strip()
            return json.loads(clean)
        except json.JSONDecodeError:
            match = re.search(r"[\[{].*[\]}]", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        return None

    # ── Geração de questões de aulas ──────────────────────────────────────────

    def generate_lesson_questions(
        self,
        lesson_context: str,
        lesson_title: str,
        count: int = 5,
        difficulty: str = "medium",
        video_url: Optional[str] = None,
    ) -> list[dict]:
        """
        Gera questões para uma aula.

        Se video_url for YouTube, passa a URL diretamente ao Gemini.
        O Gemini analisa o vídeo nos próprios servidores do Google.
        Fallback para contexto textual se não houver vídeo ou se falhar.
        """
        is_youtube = video_url and (
            "youtube.com" in video_url or "youtu.be" in video_url
        )

        if is_youtube:
            logger.info(
                f"generate_lesson_questions: usando YouTube URL para '{lesson_title}'"
            )
            result = self._generate_from_youtube_url(
                video_url, lesson_title, count, difficulty
            )
            if result:
                return result
            logger.warning(
                f"generate_lesson_questions: YouTube URL falhou, usando fallback de contexto"
            )

        return self._generate_from_context(
            lesson_context, lesson_title, count, difficulty
        )

    def _generate_from_youtube_url(
        self,
        video_url: str,
        lesson_title: str,
        count: int,
        difficulty: str,
    ) -> list[dict]:
        """
        Gera questões passando a URL do YouTube diretamente ao Gemini.
        Sem youtube-transcript-api — Gemini busca o vídeo no Google.
        """
        if count >= 5:
            easy = max(1, count // 4)
            hard = max(1, count // 4)
            medium = count - easy - hard
            dist = f"{easy} fáceis, {medium} médias e {hard} difíceis"
        else:
            dist = f"{count} questão(ões)"

        prompt = f"""Você é um professor especialista em concursos públicos brasileiros.

Assista ao vídeo desta aula e crie {count} questões de múltipla escolha no padrão concurso público.

TÍTULO DA AULA: {lesson_title}
DISTRIBUIÇÃO: {dist}

INSTRUÇÕES:
- Cada questão deve ter exatamente 4 alternativas: A, B, C, D
- Use APENAS o conteúdo explicado no vídeo — não invente informações externas
- As questões devem avaliar compreensão real do que foi ensinado
- Os distratores (alternativas erradas) devem ser plausíveis
- Escreva em português formal (padrão concurso público)
- A justificativa deve citar o conteúdo explicado no vídeo

Responda APENAS com JSON válido (lista), sem texto adicional:
[
  {{
    "statement": "enunciado completo da questão",
    "discipline": "disciplina ou tema da aula",
    "topic": "tópico específico desta questão",
    "difficulty": "easy | medium | hard",
    "correct_alternative_key": "a | b | c | d",
    "correct_justification": "explicação citando o vídeo",
    "alternatives": [
      {{"key": "a", "text": "texto da alternativa A", "distractor_justification": null}},
      {{"key": "b", "text": "texto da alternativa B", "distractor_justification": "por que B está errada"}},
      {{"key": "c", "text": "texto da alternativa C", "distractor_justification": "por que C está errada"}},
      {{"key": "d", "text": "texto da alternativa D", "distractor_justification": "por que D está errada"}}
    ]
  }}
]

distractor_justification deve ser null para a alternativa correta."""

        response = self._call_with_video(video_url, prompt, max_tokens=8192)
        result = self._parse_json(response)

        if isinstance(result, list):
            valid = [
                self._validate_question(q) for q in result if self._is_valid_question(q)
            ]
            logger.info(
                f"_generate_from_youtube_url: {len(valid)} questões para '{lesson_title}'"
            )
            return valid

        logger.warning(
            f"_generate_from_youtube_url: sem resultado para '{lesson_title}'"
        )
        return []

    def _generate_from_context(
        self,
        lesson_context: str,
        lesson_title: str,
        count: int,
        difficulty: str,
    ) -> list[dict]:
        """Fallback: gera questões baseadas no contexto textual da aula."""
        difficulty_label = {
            "easy": "fácil — conceitos básicos",
            "medium": "médio — requer compreensão e aplicação",
            "hard": "difícil — análise, interpretação, casos complexos",
        }.get(difficulty, "médio")

        prompt = f"""Você é um professor especialista em concursos públicos.

Baseado no conteúdo da aula abaixo, crie {count} questão(ões) de múltipla escolha.

CONTEÚDO:
{lesson_context}

INSTRUÇÕES:
- Dificuldade: {difficulty_label}
- 4 alternativas por questão (a, b, c, d)
- Apenas conteúdo presente acima
- Português formal (padrão concurso)

APENAS JSON válido (lista):
[{{
  "statement": "...", "discipline": "...", "topic": "...", "difficulty": "{difficulty}",
  "correct_alternative_key": "a|b|c|d", "correct_justification": "...",
  "alternatives": [
    {{"key": "a", "text": "...", "distractor_justification": null}},
    {{"key": "b", "text": "...", "distractor_justification": "..."}},
    {{"key": "c", "text": "...", "distractor_justification": "..."}},
    {{"key": "d", "text": "...", "distractor_justification": "..."}}
  ]
}}]"""

        response = self._call(prompt, max_tokens=6144)
        result = self._parse_json(response)
        if isinstance(result, list):
            return [
                self._validate_question(q) for q in result if self._is_valid_question(q)
            ]
        return []

    # ── Extração de questões do banco ─────────────────────────────────────────

    def extract_questions(self, text: str) -> list[dict]:
        prompt = f"""Analise o texto e extraia TODAS as questões de múltipla escolha.

Para cada questão: statement, discipline, topic, difficulty (easy/medium/hard),
exam_board (null se não mencionado), exam_year (inteiro ou null),
correct_alternative_key, correct_justification, alternatives (key, text, distractor_justification).

APENAS JSON válido (lista). Se não houver questões, retorne [].

TEXTO:
{text}"""
        response = self._call(prompt, max_tokens=8192)
        result = self._parse_json(response)
        if isinstance(result, list):
            return [
                self._validate_question(q) for q in result if self._is_valid_question(q)
            ]
        return []

    # ── Validação ─────────────────────────────────────────────────────────────

    def _is_valid_question(self, q: dict) -> bool:
        return (
            isinstance(q, dict)
            and q.get("statement", "").strip()
            and isinstance(q.get("alternatives"), list)
            and len(q["alternatives"]) >= 2
            and q.get("correct_alternative_key")
        )

    def _validate_question(self, q: dict) -> dict:
        return {
            "statement": q.get("statement", "").strip(),
            "discipline": q.get("discipline", "").strip() or None,
            "topic": q.get("topic", "").strip() or None,
            "difficulty": (
                q.get("difficulty")
                if q.get("difficulty") in ("easy", "medium", "hard")
                else "medium"
            ),
            "exam_board": q.get("exam_board") or None,
            "exam_year": int(q["exam_year"]) if q.get("exam_year") else None,
            "correct_alternative_key": q.get("correct_alternative_key", "a").lower(),
            "correct_justification": q.get("correct_justification", "").strip() or None,
            "alternatives": [
                {
                    "key": str(alt.get("key", "")).lower(),
                    "text": str(alt.get("text", "")).strip(),
                    "distractor_justification": alt.get("distractor_justification")
                    or None,
                }
                for alt in q.get("alternatives", [])
                if alt.get("key") and alt.get("text")
            ],
        }

    # ── Análise de questões do banco ──────────────────────────────────────────

    def analyze_question_metadata(
        self, statement, alternatives_text, correct_key, exam_board=""
    ):
        banca = f"Banca: {exam_board}. " if exam_board else ""
        prompt = f"""{banca}Analise a questão e extraia metadados pedagógicos.

ENUNCIADO: {statement}
ALTERNATIVAS: {alternatives_text}
GABARITO: {correct_key.upper()}

APENAS JSON: {{"discipline":"...","topic":"...","subtopic":"...","difficulty":"easy|medium|hard",
"competency":"...","correct_justification":"...",
"distractor_justifications":{{"a":"...","b":"...","c":"...","d":"...","e":"..."}}}}"""
        response = self._call(prompt, max_tokens=2048)
        result = self._parse_json(response)
        return result if isinstance(result, dict) and result.get("discipline") else None

    # ── Insights ──────────────────────────────────────────────────────────────

    def generate_student_insights(
        self,
        student_name,
        discipline_performance,
        pending_count,
        weekly_progress_percent,
    ):
        if not _GEMINI_AVAILABLE:
            return self._fallback_student_insights(
                discipline_performance, pending_count, weekly_progress_percent
            )
        perf = (
            "\n".join(
                [
                    f"- {d['discipline']}: {d['accuracy_rate']}% ({d['performance_label']})"
                    for d in discipline_performance[:5]
                ]
            )
            or "Sem dados."
        )
        prompt = f"""3 insights motivadores para {student_name}. Disciplinas:\n{perf}
Pendentes: {pending_count}. Meta semanal: {weekly_progress_percent}%.
JSON: [{{"type":"motivation|weakness|warning|positive|alert","icon":"emoji","title":"max 40","message":"max 120","action":{{"label":"...","href":"/"}}}}]
APENAS JSON."""
        response = self._call(prompt, max_tokens=1024)
        result = self._parse_json(response)
        return (
            result[:3]
            if isinstance(result, list) and result
            else self._fallback_student_insights(
                discipline_performance, pending_count, weekly_progress_percent
            )
        )

    def _fallback_student_insights(
        self, discipline_performance, pending_count, weekly_progress_percent
    ):
        insights = []
        weak = [d for d in discipline_performance if d["performance_label"] == "fraco"]
        if weak:
            worst = min(weak, key=lambda x: x["accuracy_rate"])
            insights.append(
                {
                    "type": "weakness",
                    "icon": "📚",
                    "title": f"{worst['discipline']} precisa de atenção",
                    "message": f"Taxa de acerto de {worst['accuracy_rate']}%.",
                    "action": {"label": "Praticar questões", "href": "/questions"},
                }
            )
        if weekly_progress_percent >= 80:
            insights.append(
                {
                    "type": "positive",
                    "icon": "🏆",
                    "title": "Meta semanal quase batida!",
                    "message": f"{weekly_progress_percent}% da meta. Continue assim!",
                    "action": None,
                }
            )
        elif weekly_progress_percent < 30:
            insights.append(
                {
                    "type": "warning",
                    "icon": "⏰",
                    "title": "Fique atento à sua meta",
                    "message": f"Apenas {weekly_progress_percent}% da meta semanal.",
                    "action": {"label": "Ver cronograma", "href": "/schedule"},
                }
            )
        if pending_count > 0:
            insights.append(
                {
                    "type": "motivation",
                    "icon": "✅",
                    "title": f"{pending_count} item(ns) para hoje",
                    "message": "Cada aula te aproxima da aprovação!",
                    "action": {"label": "Ver cronograma", "href": "/schedule"},
                }
            )
        if not insights:
            insights.append(
                {
                    "type": "motivation",
                    "icon": "🎯",
                    "title": "Continue estudando!",
                    "message": "Consistência é a chave da aprovação.",
                    "action": {"label": "Praticar questões", "href": "/questions"},
                }
            )
        return insights[:3]

    def generate_class_insights(
        self, total_students, engagement_rate, at_risk_count, discipline_performance
    ):
        if not _GEMINI_AVAILABLE:
            return self._fallback_class_insights(
                total_students, engagement_rate, at_risk_count, discipline_performance
            )
        worst = sorted(
            discipline_performance, key=lambda x: x.get("accuracy_rate", 100)
        )[:3]
        worst_text = ", ".join(
            [f"{d['discipline']} ({d['accuracy_rate']}%)" for d in worst]
        )
        prompt = f"""3 insights para produtor. {total_students} alunos, {engagement_rate}% engajamento, {at_risk_count} em risco, piores: {worst_text}.
[{{"type":"alert|warning|positive|info","icon":"emoji","title":"...","message":"..."}}] APENAS JSON."""
        response = self._call(prompt, max_tokens=1024)
        result = self._parse_json(response)
        return (
            result[:3]
            if isinstance(result, list)
            else self._fallback_class_insights(
                total_students, engagement_rate, at_risk_count, discipline_performance
            )
        )

    def _fallback_class_insights(
        self, total_students, engagement_rate, at_risk_count, discipline_performance
    ):
        insights = []
        if at_risk_count > 0:
            pct = round(at_risk_count / max(total_students, 1) * 100)
            insights.append(
                {
                    "type": "alert",
                    "icon": "🚨",
                    "title": f"{at_risk_count} aluno(s) em risco",
                    "message": f"{pct}% pode abandonar.",
                }
            )
        if engagement_rate < 50:
            insights.append(
                {
                    "type": "warning",
                    "icon": "📉",
                    "title": "Engajamento baixo",
                    "message": f"Apenas {engagement_rate}% ativo nos últimos 7 dias.",
                }
            )
        elif engagement_rate >= 75:
            insights.append(
                {
                    "type": "positive",
                    "icon": "🔥",
                    "title": "Turma engajada!",
                    "message": f"{engagement_rate}% de engajamento.",
                }
            )
        worst = sorted(
            discipline_performance, key=lambda x: x.get("accuracy_rate", 100)
        )
        if worst:
            d = worst[0]
            insights.append(
                {
                    "type": "info",
                    "icon": "📊",
                    "title": f"{d['discipline']} precisa de reforço",
                    "message": f"Média de {d['accuracy_rate']}%.",
                }
            )
        return insights[:3]

    def analyze_lesson_ratings(
        self, lesson_title, avg_rating, low_count, total_count, comments
    ):
        comments_text = (
            "\n".join(f"- {c}" for c in comments[:10])
            if comments
            else "Sem comentários."
        )
        prompt = f"""Aula "{lesson_title}" com nota {avg_rating}/5 ({low_count}/{total_count} baixas).
Comentários:\n{comments_text}\nDiagnóstico, problemas e sugestões. Máx 300 palavras."""
        return self._call(prompt, max_tokens=600)

