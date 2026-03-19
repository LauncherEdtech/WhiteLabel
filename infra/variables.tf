# infra/variables.tf
variable "project_name" {
  description = "Nome do projeto"
  default     = "concurso-platform"
}

variable "aws_region" {
  description = "Região AWS"
  default     = "sa-east-1"  # São Paulo
}

variable "environment" {
  description = "staging | production"
}

variable "domain_name" {
  description = "Domínio principal da plataforma"
  default     = "plataforma.com"
}

variable "db_password" {
  description = "Senha do PostgreSQL RDS"
  sensitive   = true
}

variable "redis_auth_token" {
  description = "Token de autenticação Redis"
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
  description = "URI da imagem Docker da API no ECR"
}

variable "frontend_image" {
  description = "URI da imagem Docker do Frontend no ECR"
}

variable "api_desired_count" {
  description = "Número de tarefas ECS da API"
  default     = 2
}

variable "db_instance_class" {
  description = "Classe da instância RDS"
  default     = "db.t3.small"
}