# infra/dns.tf
# DNS + SSL para launcheredu.com.br
# Gerencia: Route53 hosted zone, ACM wildcard cert, registros A para o ALB.
#
# APÓS APLICAR: copie os nameservers do output "route53_nameservers"
# e atualize no painel da Wix em Domínios → Nameservers.

# ── Route53 Hosted Zone ───────────────────────────────────────────────────────

resource "aws_route53_zone" "main" {
  name = "launcheredu.com.br"

  tags = { Name = "${var.project_name}-zone" }
}

# ── ACM Certificate (wildcard + apex) ─────────────────────────────────────────
# Cobre: launcheredu.com.br E *.launcheredu.com.br
# Região: sa-east-1 (mesma região do ALB — obrigatório para ALB)

resource "aws_acm_certificate" "wildcard" {
  domain_name               = "launcheredu.com.br"
  subject_alternative_names = ["*.launcheredu.com.br"]
  validation_method         = "DNS"

  # SEGURANÇA: create_before_destroy garante zero downtime em renovações
  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${var.project_name}-wildcard-cert" }
}

# ── Registros DNS para validação do ACM ───────────────────────────────────────
# O ACM gera CNAMEs de verificação. Terraform os cria automaticamente no Route53.
# Não é necessário nenhuma ação manual.

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

# Aguarda a validação DNS do certificado antes de prosseguir
# Pode levar alguns minutos após a propagação dos nameservers na Wix.

resource "aws_acm_certificate_validation" "wildcard" {
  certificate_arn         = aws_acm_certificate.wildcard.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]

  timeouts {
    create = "30m"
  }
}

# ── Registro A: apex → ALB ────────────────────────────────────────────────────
# launcheredu.com.br → ALB (ALIAS record — necessário para apex sem CNAME)

resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "launcheredu.com.br"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ── Registro A: wildcard → ALB ────────────────────────────────────────────────
# *.launcheredu.com.br → ALB
# Cobre: quarteconcurso.launcheredu.com.br, juridico.launcheredu.com.br, etc.

resource "aws_route53_record" "wildcard" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "*.launcheredu.com.br"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ── Registro CNAME: www → apex ────────────────────────────────────────────────
# www.launcheredu.com.br → launcheredu.com.br
# Mantém www funcionando mesmo após remover o site Wix do apex.

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.launcheredu.com.br"
  type    = "CNAME"
  ttl     = 300
  records = ["launcheredu.com.br"]
}

# ── Output: Nameservers ────────────────────────────────────────────────────────
# IMPORTANTE: Após o terraform apply, copie esses 4 valores e atualize
# no painel da Wix em: Domínios → launcheredu.com.br → Nameservers → Customizados

output "route53_nameservers" {
  description = "Nameservers para configurar na Wix (substituir os nameservers Wix por estes)"
  value       = aws_route53_zone.main.name_servers
}

output "acm_certificate_arn" {
  description = "ARN do certificado ACM wildcard (usado pelo HTTPS listener)"
  value       = aws_acm_certificate.wildcard.arn
}
