# infra/variables.tf

variable "project_name" {
  description = "Nome do projeto"
  default     = "concurso-platform"
}

variable "aws_region" {
  description = "Região AWS"
  default     = "sa-east-1"
}

variable "environment" {
  description = "staging | production"
}

variable "domain_name" {
  description = "Domínio principal da plataforma"
  default     = "launcheredu.com.br"
}

variable "db_password" {
  description = "Senha do PostgreSQL RDS"
  sensitive   = true
}

variable "redis_url" {
  description = "URL completa do Redis (Upstash rediss://...)"
  sensitive   = true
}

variable "cloudflare_tunnel_token" {
  description = "Token do Cloudflare Tunnel para o sidecar cloudflared"
  sensitive   = true
}

variable "secret_key" {
  description = "Flask SECRET_KEY"
  sensitive   = true
}

variable "jwt_secret_key" {
  description = "Flask JWT_SECRET_KEY"
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Google Gemini API Key"
  sensitive   = true
  default     = ""
}

variable "api_image" {
  description = "URI da imagem Docker da API (ECR)"
}

variable "api_desired_count" {
  description = "Número de tarefas ECS da API"
  default     = 1
}
