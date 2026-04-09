# infra/https.tf
# HTTPS listener no ALB — somente API Flask.
# Frontend migrado para Vercel: ALB não precisa mais rotear para ECS frontend.
#
# ARQUITETURA:
#   api.launcheredu.com.br → ALB → Flask API
#   Todo tráfego que chega no ALB é chamada de API.

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"

  ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn = aws_acm_certificate_validation.wildcard.certificate_arn

  # Default: tudo vai para a API Flask (único backend agora)
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  depends_on = [aws_acm_certificate_validation.wildcard]
  tags = { Name = "${var.project_name}-https-listener" }
}

# Regra explícita para /api/v1/* e /health → mantida por clareza
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
