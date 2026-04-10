# infra/autoscaling.tf
# FinOps + Auto Scaling — API Flask.
# Redis: Upstash (externo, não gerenciado pelo Terraform).
# ElastiCache removido.

# ── IAM — CloudWatch metrics ──────────────────────────────────────────────────

resource "aws_iam_role_policy" "ecs_cloudwatch_metrics" {
  name = "${var.project_name}-cloudwatch-metrics"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = "*"
        Condition = {
          StringEquals = { "cloudwatch:namespace" = "ConcursoPlataforma" }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarms",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:GetMetricData",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices", "ecs:DescribeClusters", "ecs:ListServices",
          "ecs:ListTasks", "ecs:DescribeTasks", "ecs:UpdateService",
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["rds:DescribeDBInstances", "rds:DescribeDBClusters"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["ce:GetCostAndUsage", "ce:GetCostForecast"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["logs:DescribeLogGroups", "logs:GetLogEvents", "logs:FilterLogEvents"]
        Resource = "*"
      }
    ]
  })
}

# ── Celery Worker + Beat ──────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "celery" {
  name              = "/ecs/${var.project_name}/celery"
  retention_in_days = 7
}

resource "aws_ecs_task_definition" "celery" {
  family                   = "${var.project_name}-celery"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name      = "celery"
    image     = var.api_image
    essential = true

    command = [
      "celery", "-A", "app.celery_app", "worker",
      "--beat",
      "--schedule=/tmp/celerybeat-schedule",
      "--loglevel=info",
      "--concurrency=2"
    ]

    environment = [
      { name = "FLASK_ENV",             value = "production" },
      { name = "DATABASE_URL",          value = "postgresql://concurso_user:${var.db_password}@${aws_db_instance.postgres.endpoint}/concurso_platform" },
      { name = "REDIS_URL",             value = var.redis_url },
      { name = "CELERY_BROKER_URL",     value = var.redis_url },
      { name = "CELERY_RESULT_BACKEND", value = var.redis_url },
      { name = "SECRET_KEY",            value = var.secret_key },
      { name = "JWT_SECRET_KEY",        value = var.jwt_secret_key },
      { name = "GEMINI_API_KEY",        value = var.gemini_api_key },
      { name = "AWS_DEFAULT_REGION",    value = var.aws_region },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project_name}/celery"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "celery"
      }
    }
  }])
}

resource "aws_ecs_service" "celery" {
  name            = "${var.project_name}-celery"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.celery.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  lifecycle { ignore_changes = [task_definition] }
  depends_on = [aws_ecs_service.api]
}

# ── Auto Scaling Target ───────────────────────────────────────────────────────

resource "aws_appautoscaling_target" "api" {
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
  depends_on         = [aws_ecs_service.api]
}

# ── CPU e Memória ─────────────────────────────────────────────────────────────

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.project_name}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 900
    scale_out_cooldown = 120
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  name               = "${var.project_name}-api-memory"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 75.0
    scale_in_cooldown  = 900
    scale_out_cooldown = 120
  }
}

# ── ActiveUsers (CloudWatch custom metric) ────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "users_scale_out" {
  alarm_name          = "${var.project_name}-users-high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "ActiveUsers"
  namespace           = "ConcursoPlataforma"
  period              = 60
  statistic           = "Maximum"
  threshold           = 6
  treat_missing_data  = "notBreaching"
  alarm_description   = "6+ usuários ativos → escala API"
  dimensions          = { Environment = "production" }
  alarm_actions       = [aws_appautoscaling_policy.api_users_scale_out.arn]
}

resource "aws_cloudwatch_metric_alarm" "users_scale_in" {
  alarm_name          = "${var.project_name}-users-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 10
  metric_name         = "ActiveUsers"
  namespace           = "ConcursoPlataforma"
  period              = 60
  statistic           = "Maximum"
  threshold           = 6
  treat_missing_data  = "notBreaching"
  alarm_description   = "< 6 usuários por 10min → reduz API para 1 task"
  dimensions          = { Environment = "production" }
  alarm_actions       = [aws_appautoscaling_policy.api_users_scale_in.arn]
}

resource "aws_appautoscaling_policy" "api_users_scale_out" {
  name               = "${var.project_name}-api-users-out"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  step_scaling_policy_configuration {
    adjustment_type         = "ExactCapacity"
    cooldown                = 120
    metric_aggregation_type = "Maximum"

    step_adjustment {
      metric_interval_lower_bound = 0
      metric_interval_upper_bound = 25
      scaling_adjustment          = 2
    }

    step_adjustment {
      metric_interval_lower_bound = 25
      metric_interval_upper_bound = 75
      scaling_adjustment          = 3
    }

    step_adjustment {
      metric_interval_lower_bound = 75
      scaling_adjustment          = 4
    }
  }
}

resource "aws_appautoscaling_policy" "api_users_scale_in" {
  name               = "${var.project_name}-api-users-in"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  step_scaling_policy_configuration {
    adjustment_type         = "ExactCapacity"
    cooldown                = 600
    metric_aggregation_type = "Maximum"

    step_adjustment {
      metric_interval_upper_bound = 0
      scaling_adjustment          = 1
    }
  }
}

# ── Scheduled Scaling ─────────────────────────────────────────────────────────

resource "aws_appautoscaling_scheduled_action" "api_night" {
  name               = "${var.project_name}-api-night"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  schedule           = "cron(0 2 * * ? *)"

  scalable_target_action {
    min_capacity = 1
    max_capacity = 1
  }
}

resource "aws_appautoscaling_scheduled_action" "api_weekday" {
  name               = "${var.project_name}-api-weekday"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  schedule           = "cron(0 10 ? * MON-FRI *)"

  scalable_target_action {
    min_capacity = 1
    max_capacity = 4
  }
}

resource "aws_appautoscaling_scheduled_action" "api_saturday" {
  name               = "${var.project_name}-api-saturday"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  schedule           = "cron(0 9 ? * SAT *)"

  scalable_target_action {
    min_capacity = 1
    max_capacity = 3
  }
}

# ── ECR Lifecycle ─────────────────────────────────────────────────────────────

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Remove imagens sem tag além de 5"
        selection    = { tagStatus = "untagged", countType = "imageCountMoreThan", countNumber = 5 }
        action       = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Mantém últimas 15 imagens com tag"
        selection    = { tagStatus = "tagged", tagPrefixList = ["sha-", "v", "main"], countType = "imageCountMoreThan", countNumber = 15 }
        action       = { type = "expire" }
      }
    ]
  })
}

# ── CloudWatch Alarms de saúde ────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_cpu_high" {
  alarm_name          = "${var.project_name}-api-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85.0
  alarm_description   = "API CPU > 85% por 15min"
  treat_missing_data  = "notBreaching"
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }
}

resource "aws_cloudwatch_metric_alarm" "api_cpu_idle" {
  alarm_name          = "${var.project_name}-api-cpu-idle"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 12
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 3.0
  alarm_description   = "API CPU < 3% por 1h — tasks ociosas"
  treat_missing_data  = "notBreaching"
  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }
}
