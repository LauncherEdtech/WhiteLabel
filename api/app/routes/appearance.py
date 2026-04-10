from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy.orm.attributes import flag_modified

from app.extensions import db
from app.models.user import UserRole
from app.middleware.tenant import require_tenant, get_current_tenant

appearance_bp = Blueprint("appearance", __name__)

COLOR_PALETTES = {
    "midnight": {
        "name": "Meia-Noite",
        "description": "Escuro profundo com azul elétrico",
        "preview": ["#0F1117", "#1E2230", "#3B82F6"],
        "dark": True,
        "vars": {
            "background": "222 47% 7%",
            "foreground": "213 31% 91%",
            "card": "222 40% 10%",
            "card-foreground": "213 31% 91%",
            "border": "222 30% 16%",
            "input": "222 30% 16%",
            "primary": "217 91% 60%",
            "primary-foreground": "222 47% 7%",
            "secondary": "222 30% 18%",
            "secondary-foreground": "213 31% 80%",
            "muted": "222 30% 15%",
            "muted-foreground": "213 20% 55%",
            "accent": "222 30% 18%",
            "accent-foreground": "213 31% 91%",
            "destructive": "0 72% 51%",
            "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%",
            "warning": "38 92% 50%",
            "ring": "217 91% 60%",
            "radius": "0.5rem",
        },
    },
    "tactical": {
        "name": "Tático",
        "description": "Verde militar com cinza grafite",
        "preview": ["#111318", "#1C2420", "#22C55E"],
        "dark": True,
        "vars": {
            "background": "225 18% 8%",
            "foreground": "120 10% 88%",
            "card": "225 15% 11%",
            "card-foreground": "120 10% 88%",
            "border": "225 12% 18%",
            "input": "225 12% 18%",
            "primary": "142 71% 45%",
            "primary-foreground": "225 18% 8%",
            "secondary": "225 12% 16%",
            "secondary-foreground": "120 10% 75%",
            "muted": "225 12% 14%",
            "muted-foreground": "120 5% 50%",
            "accent": "225 12% 16%",
            "accent-foreground": "120 10% 88%",
            "destructive": "0 72% 51%",
            "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%",
            "warning": "38 92% 50%",
            "ring": "142 71% 45%",
            "radius": "0.375rem",
        },
    },
    "carbon": {
        "name": "Carbono",
        "description": "Preto carvão com vermelho intenso",
        "preview": ["#0C0C0F", "#18181F", "#EF4444"],
        "dark": True,
        "vars": {
            "background": "240 10% 4%",
            "foreground": "0 0% 90%",
            "card": "240 8% 7%",
            "card-foreground": "0 0% 90%",
            "border": "240 6% 14%",
            "input": "240 6% 14%",
            "primary": "0 72% 51%",
            "primary-foreground": "0 0% 100%",
            "secondary": "240 6% 12%",
            "secondary-foreground": "0 0% 75%",
            "muted": "240 6% 10%",
            "muted-foreground": "0 0% 45%",
            "accent": "240 6% 12%",
            "accent-foreground": "0 0% 90%",
            "destructive": "0 72% 51%",
            "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%",
            "warning": "38 92% 50%",
            "ring": "0 72% 51%",
            "radius": "0.25rem",
        },
    },
    "slate_dark": {
        "name": "Slate Dark",
        "description": "Cinza elegante com violeta",
        "preview": ["#0D1117", "#161B27", "#8B5CF6"],
        "dark": True,
        "vars": {
            "background": "220 27% 5%",
            "foreground": "220 14% 90%",
            "card": "220 24% 8%",
            "card-foreground": "220 14% 90%",
            "border": "220 18% 14%",
            "input": "220 18% 14%",
            "primary": "262 83% 58%",
            "primary-foreground": "0 0% 100%",
            "secondary": "220 18% 13%",
            "secondary-foreground": "220 14% 75%",
            "muted": "220 18% 11%",
            "muted-foreground": "220 8% 46%",
            "accent": "220 18% 13%",
            "accent-foreground": "220 14% 90%",
            "destructive": "0 72% 51%",
            "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%",
            "warning": "38 92% 50%",
            "ring": "262 83% 58%",
            "radius": "0.5rem",
        },
    },
    "classic": {
        "name": "Clássico",
        "description": "Branco limpo com azul índigo",
        "preview": ["#FFFFFF", "#F8FAFC", "#4F46E5"],
        "dark": False,
        "vars": {
            "background": "0 0% 100%",
            "foreground": "222 47% 11%",
            "card": "0 0% 100%",
            "card-foreground": "222 47% 11%",
            "border": "214 32% 91%",
            "input": "214 32% 91%",
            "primary": "243 75% 59%",
            "primary-foreground": "0 0% 100%",
            "secondary": "214 32% 95%",
            "secondary-foreground": "222 47% 11%",
            "muted": "214 32% 96%",
            "muted-foreground": "215 16% 47%",
            "accent": "214 32% 95%",
            "accent-foreground": "222 47% 11%",
            "destructive": "0 84% 60%",
            "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%",
            "warning": "38 92% 50%",
            "ring": "243 75% 59%",
            "radius": "0.5rem",
        },
    },
    "emerald": {
        "name": "Esmeralda",
        "description": "Branco com verde esmeralda",
        "preview": ["#FFFFFF", "#F0FDF4", "#10B981"],
        "dark": False,
        "vars": {
            "background": "0 0% 100%",
            "foreground": "162 47% 8%",
            "card": "0 0% 100%",
            "card-foreground": "162 47% 8%",
            "border": "162 20% 90%",
            "input": "162 20% 90%",
            "primary": "160 84% 39%",
            "primary-foreground": "0 0% 100%",
            "secondary": "162 20% 95%",
            "secondary-foreground": "162 47% 8%",
            "muted": "162 20% 96%",
            "muted-foreground": "162 16% 44%",
            "accent": "162 20% 95%",
            "accent-foreground": "162 47% 8%",
            "destructive": "0 84% 60%",
            "destructive-foreground": "0 0% 100%",
            "success": "160 84% 39%",
            "warning": "38 92% 50%",
            "ring": "160 84% 39%",
            "radius": "0.5rem",
        },
    },
    "warm": {
        "name": "Âmbar",
        "description": "Tom quente com laranja dourado",
        "preview": ["#FFFBF5", "#FEF3C7", "#F59E0B"],
        "dark": False,
        "vars": {
            "background": "40 100% 99%",
            "foreground": "25 47% 11%",
            "card": "0 0% 100%",
            "card-foreground": "25 47% 11%",
            "border": "38 40% 88%",
            "input": "38 40% 88%",
            "primary": "38 92% 50%",
            "primary-foreground": "25 47% 11%",
            "secondary": "38 40% 94%",
            "secondary-foreground": "25 47% 11%",
            "muted": "38 40% 96%",
            "muted-foreground": "25 16% 44%",
            "accent": "38 40% 94%",
            "accent-foreground": "25 47% 11%",
            "destructive": "0 84% 60%",
            "destructive-foreground": "0 0% 100%",
            "success": "142 71% 45%",
            "warning": "38 92% 50%",
            "ring": "38 92% 50%",
            "radius": "0.75rem",
        },
    },
}

VALID_STUDENT_LAYOUTS = {"sidebar", "topbar", "minimal"}
VALID_PRODUCER_LAYOUTS = {"sidebar", "topbar"}
VALID_LOGIN_LAYOUTS = {"split", "centered", "fullbg", "minimal"}

LOGIN_CONTENT_FIELDS = [
    "login_badge",
    "login_headline",
    "login_subtext",
    "login_features",
    "login_form_title",
    "login_form_subtitle",
]


def _require_producer_admin():
    claims = get_jwt()
    if claims.get("role") not in (
        UserRole.SUPER_ADMIN.value,
        UserRole.PRODUCER_ADMIN.value,
    ):
        return jsonify({"error": "forbidden", "message": "Acesso negado."}), 403
    return None


@appearance_bp.before_request
def before_request():
    from app.middleware.tenant import resolve_tenant

    resolve_tenant()


@appearance_bp.route("/", methods=["GET"])
@jwt_required()
@require_tenant
def get_appearance():
    tenant = get_current_tenant()
    branding = dict(tenant.branding or {})

    appearance = {
        "color_palette": branding.get("color_palette", "classic"),
        "custom_vars": branding.get("custom_vars", {}),
        "layout_student": branding.get("layout_student", "sidebar"),
        "layout_producer": branding.get("layout_producer", "sidebar"),
        "login_layout": branding.get("login_layout", "split"),
        "login_bg_url": branding.get("login_bg_url"),
        "login_bg_color": branding.get("login_bg_color"),
        # conteúdo editável
        "login_badge": branding.get("login_badge"),
        "login_headline": branding.get("login_headline"),
        "login_subtext": branding.get("login_subtext"),
        "login_features": branding.get("login_features"),
        "login_form_title": branding.get("login_form_title"),
        "login_form_subtitle": branding.get("login_form_subtitle"),
        "instagram_handle": branding.get("instagram_handle"),
        "capsule_style": branding.get("capsule_style", "operativo"),
    }

    return (
        jsonify(
            {
                "appearance": appearance,
                "palettes": {
                    key: {
                        "key": key,
                        "name": p["name"],
                        "description": p["description"],
                        "preview": p["preview"],
                        "dark": p["dark"],
                    }
                    for key, p in COLOR_PALETTES.items()
                },
                "layouts": {
                    "student": list(VALID_STUDENT_LAYOUTS),
                    "producer": list(VALID_PRODUCER_LAYOUTS),
                    "login": list(VALID_LOGIN_LAYOUTS),
                },
            }
        ),
        200,
    )


@appearance_bp.route("/", methods=["PUT"])
@jwt_required()
@require_tenant
def update_appearance():
    err = _require_producer_admin()
    if err:
        return err

    tenant = get_current_tenant()
    data = request.get_json(force=True) or {}
    branding = dict(tenant.branding or {})

    # ── Paleta ────────────────────────────────────────────────────────────────
    if "color_palette" in data:
        palette_key = data["color_palette"]
        if palette_key != "custom" and palette_key not in COLOR_PALETTES:
            return (
                jsonify(
                    {
                        "error": "invalid_palette",
                        "valid": list(COLOR_PALETTES.keys()) + ["custom"],
                    }
                ),
                400,
            )
        branding["color_palette"] = palette_key

    if "custom_vars" in data:
        if not isinstance(data["custom_vars"], dict):
            return jsonify({"error": "custom_vars deve ser um objeto"}), 400
        branding["custom_vars"] = data["custom_vars"]

    # ── Layouts ───────────────────────────────────────────────────────────────
    if "layout_student" in data:
        if data["layout_student"] not in VALID_STUDENT_LAYOUTS:
            return (
                jsonify(
                    {"error": "invalid_layout", "valid": list(VALID_STUDENT_LAYOUTS)}
                ),
                400,
            )
        branding["layout_student"] = data["layout_student"]

    if "layout_producer" in data:
        if data["layout_producer"] not in VALID_PRODUCER_LAYOUTS:
            return (
                jsonify(
                    {"error": "invalid_layout", "valid": list(VALID_PRODUCER_LAYOUTS)}
                ),
                400,
            )
        branding["layout_producer"] = data["layout_producer"]

    if "login_layout" in data:
        if data["login_layout"] not in VALID_LOGIN_LAYOUTS:
            return (
                jsonify(
                    {"error": "invalid_layout", "valid": list(VALID_LOGIN_LAYOUTS)}
                ),
                400,
            )
        branding["login_layout"] = data["login_layout"]

    if "login_bg_url" in data:
        branding["login_bg_url"] = data["login_bg_url"] or None

    if "login_bg_color" in data:
        branding["login_bg_color"] = data["login_bg_color"] or None

    # ── Cápsula de Estudos ────────────────────────────────────────────────────
    if "capsule_style" in data:
        if data["capsule_style"] not in ("operativo", "campeao", "relatorio", "neon", "bold", "elegante"):
            return jsonify({"error": "invalid_capsule_style"}), 400
        branding["capsule_style"] = data["capsule_style"]

    # ── Instagram do produtor ─────────────────────────────────────────────────────
    if "instagram_handle" in data:
        handle = (data.get("instagram_handle") or "").strip().lstrip("@")[:50]
        branding["instagram_handle"] = handle or None

    # ── Conteúdo editável do login ────────────────────────────────────────────
    for field in LOGIN_CONTENT_FIELDS:
        if field not in data:
            continue
        value = data[field]
        if field == "login_features":
            if not isinstance(value, list):
                return jsonify({"error": f"{field} deve ser uma lista"}), 400
            value = [str(v)[:200] for v in value[:10]]
        elif isinstance(value, str):
            value = value[:500]
        branding[field] = value

    tenant.branding = branding
    flag_modified(tenant, "branding")
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Aparência atualizada com sucesso.",
                "appearance": {
                    "color_palette": branding.get("color_palette", "classic"),
                    "custom_vars": branding.get("custom_vars", {}),
                    "layout_student": branding.get("layout_student", "sidebar"),
                    "layout_producer": branding.get("layout_producer", "sidebar"),
                    "login_layout": branding.get("login_layout", "split"),
                    "login_bg_url": branding.get("login_bg_url"),
                    "login_bg_color": branding.get("login_bg_color"),
                    "login_badge": branding.get("login_badge"),
                    "login_headline": branding.get("login_headline"),
                    "login_subtext": branding.get("login_subtext"),
                    "login_features": branding.get("login_features"),
                    "login_form_title": branding.get("login_form_title"),
                    "login_form_subtitle": branding.get("login_form_subtitle"),
                    "instagram_handle": branding.get("instagram_handle"),
                    "capsule_style": branding.get("capsule_style", "operativo"),
                },
                "css_vars": (
                    COLOR_PALETTES.get(
                        branding.get("color_palette", "classic"),
                        COLOR_PALETTES["classic"],
                    )["vars"]
                    if branding.get("color_palette") != "custom"
                    else branding.get("custom_vars", {})
                ),
            }
        ),
        200,
    )


@appearance_bp.route("/palettes", methods=["GET"])
def list_palettes():
    return (
        jsonify(
            {
                key: {
                    "key": key,
                    "name": p["name"],
                    "description": p["description"],
                    "preview": p["preview"],
                    "dark": p["dark"],
                    "vars": p["vars"],
                }
                for key, p in COLOR_PALETTES.items()
            }
        ),
        200,
    )
