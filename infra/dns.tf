# infra/dns.tf
# DNS para launcheredu.com.br após migração Vercel
#
# ARQUITETURA:
#   launcheredu.com.br      → Vercel (landing + admin)
#   *.launcheredu.com.br    → Vercel (tenants: qg-concursos.launcheredu.com.br etc.)
#   api.launcheredu.com.br  → ALB   (Flask API — direto, sem passar pelo Vercel)

resource "aws_route53_zone" "main" {
  name = "launcheredu.com.br"
  tags = { Name = "${var.project_name}-zone" }
}

# ── ACM Certificate (wildcard + apex) ─────────────────────────────────────────

resource "aws_acm_certificate" "wildcard" {
  domain_name               = "launcheredu.com.br"
  subject_alternative_names = ["*.launcheredu.com.br"]
  validation_method         = "DNS"

  lifecycle { create_before_destroy = true }

  tags = { Name = "${var.project_name}-wildcard-cert" }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.wildcard.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "wildcard" {
  certificate_arn         = aws_acm_certificate.wildcard.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
  timeouts { create = "30m" }
}

# ── api.launcheredu.com.br → ALB ──────────────────────────────────────────────
# Único ponto de entrada da Flask API. Vercel usa esse subdomínio.

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.launcheredu.com.br"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ── launcheredu.com.br (apex) → Vercel ────────────────────────────────────────
# Apex não suporta CNAME — usa A record com IP anycast do Vercel.
# 76.76.21.21 é o anycast estável do Vercel (não muda).

resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "launcheredu.com.br"
  type    = "A"
  ttl     = 300
  records = ["76.76.21.21"]
}

# ── *.launcheredu.com.br → Vercel ─────────────────────────────────────────────
# Todos os tenants vão para o Vercel.
# proxy.ts resolve o tenant pelo subdomínio via Edge Middleware.

resource "aws_route53_record" "wildcard" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "*.launcheredu.com.br"
  type    = "CNAME"
  ttl     = 300
  records = ["cname.vercel-dns.com"]
}

# ── www → apex ────────────────────────────────────────────────────────────────

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.launcheredu.com.br"
  type    = "CNAME"
  ttl     = 300
  records = ["launcheredu.com.br"]
}

output "route53_nameservers" {
  description = "Nameservers para configurar no registro.br"
  value       = aws_route53_zone.main.name_servers
}

output "acm_certificate_arn" {
  description = "ARN do certificado ACM wildcard"
  value       = aws_acm_certificate.wildcard.arn
}
