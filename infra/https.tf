# infra/https.tf
# HTTPS listener no ALB existente + redirect HTTP→HTTPS.
#
# Este arquivo:
# 1. Adiciona listener HTTPS:443 com o cert ACM wildcard
# 2. Move as regras de roteamento (api, frontend) para o listener HTTPS
#
# CORREÇÃO: regra da API usa /api/v1/* (não /api/*) para não interceptar
# rotas internas do Next.js como /api/tenant e /api/auth.

# ── HTTPS Listener ────────────────────────────────────────────────────────────

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"

  # SEGURANÇA: TLS 1.2+ apenas. Desabilita TLS 1.0 e 1.1 vulneráveis.
  ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn = aws_acm_certificate_validation.wildcard.certificate_arn

  # Default: tudo que não bate com as regras abaixo → frontend
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  depends_on = [aws_acm_certificate_validation.wildcard]

  tags = { Name = "${var.project_name}-https-listener" }
}

# ── Regras HTTPS: /api/v1/* e /health → Flask ────────────────────────────────
# IMPORTANTE: /api/v1/* e NÃO /api/* para não interceptar rotas internas
# do Next.js: /api/tenant (branding), /api/auth (next-auth), etc.
# Com /api/*, o ALB capturava /api/tenant e mandava para o Flask que não
# tem essa rota → 404 → branding padrão em vez do branding do produtor.

resource "aws_lb_listener_rule" "https_api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/v1/*", "/health"]
    }
  }
}

# ── Regras HTTPS: /* → Next.js ────────────────────────────────────────────────

resource "aws_lb_listener_rule" "https_frontend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }
}
