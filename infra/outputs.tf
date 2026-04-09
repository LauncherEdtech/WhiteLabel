# infra/outputs.tf

output "alb_dns_name" {
  description = "DNS do Load Balancer (usar como INTERNAL_API_URL no Vercel)"
  value       = aws_lb.main.dns_name
}

output "api_url" {
  description = "URL pública da API"
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

output "redis_endpoint" {
  description = "Endpoint do ElastiCache Redis"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "Nome do cluster ECS"
  value       = aws_ecs_cluster.main.name
}
