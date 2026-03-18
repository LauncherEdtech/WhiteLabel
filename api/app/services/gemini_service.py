# api/app/services/gemini_service.py
"""
Serviço de integração com Google Gemini API.
Responsável por:
- Extração de questões de texto/PDF
- Geração de insights do aluno
- Resumo de aulas
"""

import os
import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Fallback rules-based quando Gemini não está configurado
_GEMINI_AVAILABLE = False
try:
    import google.generativeai as genai

    _GEMINI_AVAILABLE = bool(os.environ.get("GEMINI_API_KEY"))
    if _GEMINI_AVAILABLE:
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        logger.info("Gemini API configurada com sucesso.")
except ImportError:
    logger.warning("google-generativeai não instalado. Usando fallback.")


class GeminiService:

    MODEL = "gemini-1.5-flash"

    def _call(self, prompt: str, max_tokens: int = 4096) -> Optional[str]:
        """Faz uma chamada ao Gemini e retorna o texto da resposta."""
        if not _GEMINI_AVAILABLE:
            return None
        try:
            model = genai.GenerativeModel(self.MODEL)
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    max_output_tokens=max_tokens,
                    temperature=0.3,
                ),
            )
            return response.text
        except Exception as e:
            logger.error(f"Erro Gemini: {e}")
            return None

    def _parse_json(self, text: str) -> Optional[dict | list]:
        """Extrai JSON de uma resposta do Gemini."""
        if not text:
            return None
        try:
            # Remove markdown code blocks se presentes
            clean = re.sub(r"```(?:json)?\n?", "", text).strip()
            clean = clean.rstrip("`").strip()
            return json.loads(clean)
        except json.JSONDecodeError:
            # Tenta extrair apenas o JSON do texto
            match = re.search(r"[\[{].*[\]}]", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        return None

    # ── Extração de questões ──────────────────────────────────────────────────

    def extract_questions(self, text: str) -> list[dict]:
        """
        Extrai questões de um texto usando Gemini.
        Retorna lista de dicts compatíveis com o modelo Question.
        """
        prompt = f"""Você é um especialista em concursos públicos brasileiros.

Analise o texto abaixo e extraia TODAS as questões de múltipla escolha encontradas.

Para cada questão extraída, forneça:
- statement: enunciado completo da questão
- discipline: disciplina (ex: "Direito Penal", "Português", "Matemática")
- topic: tema específico dentro da disciplina
- difficulty: "easy", "medium" ou "hard"
- exam_board: banca examinadora se mencionada (ex: "CESPE", "FGV")
- exam_year: ano se mencionado (número inteiro ou null)
- correct_alternative_key: letra da alternativa correta ("a", "b", "c", "d" ou "e")
- correct_justification: explicação de por que a alternativa está correta
- alternatives: lista de objetos com:
  - key: letra ("a", "b", "c", "d", "e")
  - text: texto da alternativa
  - distractor_justification: por que esta alternativa está errada (apenas para as incorretas)

Se não houver questões completas no texto, retorne uma lista vazia.

Responda APENAS com JSON válido, sem texto adicional. Formato:
[
  {{
    "statement": "...",
    "discipline": "...",
    "topic": "...",
    "difficulty": "medium",
    "exam_board": null,
    "exam_year": null,
    "correct_alternative_key": "a",
    "correct_justification": "...",
    "alternatives": [
      {{"key": "a", "text": "...", "distractor_justification": null}},
      {{"key": "b", "text": "...", "distractor_justification": "..."}},
      {{"key": "c", "text": "...", "distractor_justification": "..."}},
      {{"key": "d", "text": "...", "distractor_justification": "..."}}
    ]
  }}
]

TEXTO PARA ANALISAR:
{text}"""

        response = self._call(prompt, max_tokens=8192)
        result = self._parse_json(response)

        if isinstance(result, list):
            return [
                self._validate_question(q) for q in result if self._is_valid_question(q)
            ]

        logger.warning("Gemini não retornou lista de questões. Usando fallback.")
        return []

    def _is_valid_question(self, q: dict) -> bool:
        """Valida se uma questão extraída tem os campos mínimos."""
        return (
            isinstance(q, dict)
            and q.get("statement", "").strip()
            and isinstance(q.get("alternatives"), list)
            and len(q["alternatives"]) >= 2
            and q.get("correct_alternative_key")
        )

    def _validate_question(self, q: dict) -> dict:
        """Normaliza campos da questão extraída."""
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

    # ── Insights do aluno ─────────────────────────────────────────────────────

    def generate_student_insights(
        self,
        student_name: str,
        discipline_performance: list[dict],
        pending_count: int,
        weekly_progress_percent: int,
    ) -> list[dict]:
        """Gera insights personalizados para o dashboard do aluno."""
        if not _GEMINI_AVAILABLE:
            return self._fallback_student_insights(
                discipline_performance, pending_count, weekly_progress_percent
            )

        # Formata dados para o prompt
        perf_text = (
            "\n".join(
                [
                    f"- {d['discipline']}: {d['accuracy_rate']}% acerto ({d['performance_label']})"
                    for d in discipline_performance[:5]
                ]
            )
            or "Nenhum dado ainda."
        )

        prompt = f"""Você é um tutor especializado em aprovação em concursos públicos.

Analise o desempenho do aluno {student_name} e gere EXATAMENTE 3 insights motivadores e acionáveis.

DADOS:
- Disciplinas:
{perf_text}
- Itens pendentes hoje: {pending_count}
- Progresso da meta semanal: {weekly_progress_percent}%

Gere 3 insights no formato JSON:
[
  {{
    "type": "motivation|weakness|warning|positive|alert",
    "icon": "emoji",
    "title": "título curto (max 40 chars)",
    "message": "mensagem motivadora e específica (max 120 chars)",
    "action": {{"label": "texto do botão", "href": "/rota"}} ou null
  }}
]

Regras:
- Seja específico com os dados (cite a disciplina, o percentual)
- Tom encorajador mesmo para pontos fracos
- Ações práticas (ex: link para questões da disciplina fraca)
- Responda APENAS com JSON válido"""

        response = self._call(prompt, max_tokens=1024)
        result = self._parse_json(response)

        if isinstance(result, list) and len(result) >= 1:
            return result[:3]

        return self._fallback_student_insights(
            discipline_performance, pending_count, weekly_progress_percent
        )

    def _fallback_student_insights(
        self,
        discipline_performance: list[dict],
        pending_count: int,
        weekly_progress_percent: int,
    ) -> list[dict]:
        """Insights baseados em regras quando Gemini não está disponível."""
        insights = []

        # Disciplina mais fraca
        weak = [d for d in discipline_performance if d["performance_label"] == "fraco"]
        if weak:
            worst = min(weak, key=lambda x: x["accuracy_rate"])
            insights.append(
                {
                    "type": "weakness",
                    "icon": "📚",
                    "title": f"{worst['discipline']} precisa de atenção",
                    "message": f"Taxa de acerto de {worst['accuracy_rate']}%. Foque nas questões desta disciplina.",
                    "action": {"label": "Praticar questões", "href": "/questions"},
                }
            )

        # Meta semanal
        if weekly_progress_percent >= 80:
            insights.append(
                {
                    "type": "positive",
                    "icon": "🏆",
                    "title": "Meta semanal quase batida!",
                    "message": f"Você está em {weekly_progress_percent}% da sua meta. Continue assim!",
                    "action": None,
                }
            )
        elif weekly_progress_percent < 30:
            insights.append(
                {
                    "type": "warning",
                    "icon": "⏰",
                    "title": "Fique atento à sua meta",
                    "message": f"Apenas {weekly_progress_percent}% da meta semanal concluída. Há tempo para recuperar!",
                    "action": {"label": "Ver cronograma", "href": "/schedule"},
                }
            )

        # Pendências
        if pending_count > 0:
            insights.append(
                {
                    "type": "motivation",
                    "icon": "✅",
                    "title": f"{pending_count} item(ns) para hoje",
                    "message": "Você tem itens no cronograma de hoje. Cada aula te aproxima da aprovação!",
                    "action": {"label": "Ver cronograma", "href": "/schedule"},
                }
            )

        # Fallback genérico
        if not insights:
            insights.append(
                {
                    "type": "motivation",
                    "icon": "🎯",
                    "title": "Continue estudando!",
                    "message": "Consistência é a chave da aprovação. Estude um pouco todos os dias.",
                    "action": {"label": "Praticar questões", "href": "/questions"},
                }
            )

        return insights[:3]

    # ── Resumo de aula ────────────────────────────────────────────────────────

    def generate_lesson_summary(
        self,
        lesson_title: str,
        lesson_content: str,
        discipline: str,
    ) -> Optional[str]:
        """Gera resumo estruturado de uma aula para o aluno."""
        if not _GEMINI_AVAILABLE:
            return None

        prompt = f"""Você é um professor especialista em concursos públicos.

Crie um resumo CONCISO e ESTRUTURADO da aula abaixo, ideal para revisão rápida.

AULA: {lesson_title}
DISCIPLINA: {discipline}

CONTEÚDO:
{lesson_content[:5000]}

Formato do resumo:
1. **Pontos principais** (3-5 bullet points)
2. **Conceitos-chave** (termos importantes com definição breve)
3. **Dica para prova** (1 observação sobre como esse tema cai em provas)

Seja direto, use linguagem clara e concisa. Máximo 300 palavras."""

        return self._call(prompt, max_tokens=512)

    # ── Análise de turma ──────────────────────────────────────────────────────

    def generate_class_insights(
        self,
        total_students: int,
        engagement_rate: float,
        at_risk_count: int,
        discipline_performance: list[dict],
    ) -> list[dict]:
        """Gera insights para o dashboard do produtor."""
        if not _GEMINI_AVAILABLE:
            return self._fallback_class_insights(
                total_students, engagement_rate, at_risk_count, discipline_performance
            )

        worst_disciplines = sorted(
            discipline_performance, key=lambda x: x.get("accuracy_rate", 100)
        )[:3]
        worst_text = (
            ", ".join(
                [
                    f"{d['discipline']} ({d['accuracy_rate']}%)"
                    for d in worst_disciplines
                ]
            )
            or "dados insuficientes"
        )

        prompt = f"""Você é um analista educacional especializado em concursos públicos.

Analise os dados da turma e gere EXATAMENTE 3 insights para o produtor de conteúdo.

DADOS:
- Total de alunos: {total_students}
- Taxa de engajamento (7 dias): {engagement_rate}%
- Alunos em risco de abandono: {at_risk_count}
- Disciplinas com menor acerto: {worst_text}

Gere insights que ajudem o produtor a tomar ações concretas:
[
  {{
    "type": "alert|warning|positive|info",
    "icon": "emoji",
    "title": "título (max 40 chars)",
    "message": "insight específico com dado numérico (max 150 chars)"
  }}
]

Responda APENAS com JSON válido."""

        response = self._call(prompt, max_tokens=1024)
        result = self._parse_json(response)

        if isinstance(result, list):
            return result[:3]

        return self._fallback_class_insights(
            total_students, engagement_rate, at_risk_count, discipline_performance
        )

    def _fallback_class_insights(
        self,
        total_students: int,
        engagement_rate: float,
        at_risk_count: int,
        discipline_performance: list[dict],
    ) -> list[dict]:
        """Insights baseados em regras para o produtor."""
        insights = []

        if at_risk_count > 0:
            pct = round(at_risk_count / max(total_students, 1) * 100)
            insights.append(
                {
                    "type": "alert",
                    "icon": "🚨",
                    "title": f"{at_risk_count} aluno(s) em risco",
                    "message": f"{pct}% da turma pode abandonar. Envie uma mensagem motivacional agora.",
                }
            )

        if engagement_rate < 50:
            insights.append(
                {
                    "type": "warning",
                    "icon": "📉",
                    "title": "Engajamento baixo",
                    "message": f"Apenas {engagement_rate}% da turma ativa nos últimos 7 dias. Publique novo conteúdo.",
                }
            )
        elif engagement_rate >= 75:
            insights.append(
                {
                    "type": "positive",
                    "icon": "🔥",
                    "title": "Turma engajada!",
                    "message": f"{engagement_rate}% de engajamento nos últimos 7 dias. Ótimo resultado!",
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
                    "message": f"Média de {d['accuracy_rate']}% nesta disciplina. Considere adicionar mais questões.",
                }
            )

        return insights[:3]
