# infra/outputs.tf

output "api_url" {
  description = "URL pública da API (via Cloudflare Tunnel)"
  value       = "https://api.launcheredu.com.br/api/v1"
}

output "ecr_api_url" {
  description = "URL do repositório ECR da API"
  value       = aws_ecr_repository.api.repository_url
}

output "rds_endpoint" {
  description = "Endpoint do RDS PostgreSQL"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "Nome do cluster ECS"
  value       = aws_ecs_cluster.main.name
}
