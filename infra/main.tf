# infra/main.tf
# Concurso Platform — Infraestrutura AWS (Free Tier)
# Arquitetura: ECS Fargate (public subnets) + RDS + ElastiCache (private subnets)
# Sem NAT Gateway (custo zero) — ECS usa subnets públicas com assignPublicIp=ENABLED

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "concurso-platform-terraform-state"
    key            = "terraform.tfstate"
    region         = "sa-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_availability_zones" "available" { state = "available" }

# ══════════════════════════════════════════════════════════════════════════════
# NETWORKING
# VPC com subnets públicas (ECS) e privadas (RDS + Redis)
# Sem NAT Gateway — free tier
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

# Subnets públicas — ECS tasks rodam aqui (assignPublicIp=ENABLED)
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "${var.project_name}-public-${count.index}" }
}

# Subnets privadas — RDS e Redis ficam aqui
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "${var.project_name}-private-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = "${var.project_name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ══════════════════════════════════════════════════════════════════════════════
# SECURITY GROUPS
# ══════════════════════════════════════════════════════════════════════════════

# ALB — aceita HTTP/HTTPS da internet
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "ALB: aceita trafego HTTP/HTTPS publico"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ECS Tasks — aceita trafego do ALB, acessa RDS/Redis/ECR/internet
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-ecs-sg"
  description = "ECS tasks: aceita do ALB, sai para internet (ECR, RDS, Redis)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "API Flask do ALB"
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Frontend Next.js do ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Saída irrestrita — necessário para ECR pull, RDS, Redis, Gemini API
  egress {
    description = "Saida irrestrita"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# RDS — aceita apenas do ECS
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "RDS: aceita apenas das ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL das ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}

# Redis — aceita apenas do ECS
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Redis: aceita apenas das ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis das ECS tasks"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# ECR — Repositórios de imagens Docker
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}-api"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  lifecycle {
    prevent_destroy = false
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}-frontend"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  lifecycle {
    prevent_destroy = false
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# RDS PostgreSQL — Free Tier (db.t3.micro, 20GB)
# Fica em subnets privadas — acesso apenas via ECS
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project_name}-db-subnet" }
}

resource "aws_db_instance" "postgres" {
  identifier        = "${var.project_name}-postgres"
  engine            = "postgres"
  engine_version    = "16.13"
  instance_class    = "db.t3.micro"  # Free tier
  allocated_storage = 20
  storage_type      = "gp2"

  db_name  = "concurso_platform"
  username = "concurso_user"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Free tier settings
  storage_encrypted       = false
  backup_retention_period = 1
  multi_az                = false
  publicly_accessible     = false
  skip_final_snapshot     = true
  deletion_protection     = false

  tags = { Name = "${var.project_name}-postgres" }
}

# ══════════════════════════════════════════════════════════════════════════════
# ElastiCache Redis — Free Tier (cache.t3.micro)
# Fica em subnets privadas — acesso apenas via ECS
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-redis"
  description                = "Redis cache para ${var.project_name}"
  node_type                  = "cache.t3.micro"  # Free tier
  port                       = 6379
  num_cache_clusters         = 1
  parameter_group_name       = "default.redis7"
  automatic_failover_enabled = false

  auth_token                 = var.redis_auth_token
  transit_encryption_enabled = true
  at_rest_encryption_enabled = false

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  tags = { Name = "${var.project_name}-redis" }
}

# ══════════════════════════════════════════════════════════════════════════════
# IAM — Role para ECS Task Execution
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy_attachment" "ecs_ecr" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# ══════════════════════════════════════════════════════════════════════════════
# CLOUDWATCH LOGS
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project_name}/api"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${var.project_name}/frontend"
  retention_in_days = 7
}

# ══════════════════════════════════════════════════════════════════════════════
# ECS CLUSTER
# ✅ CORREÇÃO: containerInsights "disabled" — economia ~$10/mês
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"  # Era "enabled" — desabilitar economiza ~$10/mês
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# ECS TASK DEFINITION — API Flask
# ✅ CORREÇÃO: cpu 256 + memory 512 (era 512 + 1024) — economia ~$11/mês/task
#    Uso real observado: 0.5% CPU, 28.5% memória (~292MB de 1024MB)
#    Com 512MB: 292MB usados + 220MB de buffer → seguro
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"   
  memory                   = "512"   
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = var.api_image
    essential = true

    portMappings = [{
      containerPort = 5000
      protocol      = "tcp"
    }]

    environment = [
      { name = "FLASK_ENV",             value = "production" },
      { name = "DATABASE_URL",          value = "postgresql://concurso_user:${var.db_password}@${aws_db_instance.postgres.endpoint}/concurso_platform" },
      { name = "REDIS_URL",             value = "rediss://:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379/0" },
      { name = "SECRET_KEY",            value = var.secret_key },
      { name = "JWT_SECRET_KEY",        value = var.jwt_secret_key },
      { name = "GEMINI_API_KEY",        value = var.gemini_api_key },
      { name = "CELERY_BROKER_URL",     value = "rediss://:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379/1" },
      { name = "CELERY_RESULT_BACKEND", value = "rediss://:${var.redis_auth_token}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379/2" },
      { name = "AWS_DEFAULT_REGION",    value = var.aws_region },
    ]

    secrets = []

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project_name}/api"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:5000/health || exit 1"]
      interval    = 30
      timeout     = 10
      retries     = 3
      startPeriod = 120
    }
  }])
}

# ══════════════════════════════════════════════════════════════════════════════
# APPLICATION LOAD BALANCER
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = { Name = "${var.project_name}-alb" }
}

resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-api-tg"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  tags = { Name = "${var.project_name}-api-tg" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# ECS SERVICE — API
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 5000
  }

  depends_on = [aws_lb_listener.http]

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# ECS TASK DEFINITION — Frontend Next.js
# ══════════════════════════════════════════════════════════════════════════════

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name      = "frontend"
    image     = var.frontend_image
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV",            value = "production" },
      { name = "NEXT_PUBLIC_API_URL", value = "http://${aws_lb.main.dns_name}/api/v1" },
      { name = "PORT",                value = "3000" },
      { name = "HOSTNAME",            value = "0.0.0.0" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project_name}/frontend"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "frontend"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:3000/ || exit 1"]
      interval    = 30
      timeout     = 10
      retries     = 3
      startPeriod = 60
    }
  }])
}

# ── Target Group Frontend ──────────────────────────────────────────────────

resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-fe-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200-399"
  }

  tags = { Name = "${var.project_name}-frontend-tg" }
}

# ── ALB Listener Rules ────────────────────────────────────────────────────

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health"]
    }
  }
}

resource "aws_lb_listener_rule" "frontend" {
  listener_arn = aws_lb_listener.http.arn
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

# ── ECS Service Frontend ───────────────────────────────────────────────────

resource "aws_ecs_service" "frontend" {
  name            = "${var.project_name}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener_rule.frontend]

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}
