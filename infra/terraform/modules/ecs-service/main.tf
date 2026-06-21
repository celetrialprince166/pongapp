# ---------------------------------------------------------------------------
# Reusable ECS Fargate service. Runs in ONE of two modes:
#   * enable_blue_green = true  -> ALB blue/green service (frontend edge).
#       Uses deployment_controller ECS + BLUE_GREEN strategy, attached to the
#       blue/green target groups; ECS shifts the production listener rule.
#   * enable_service_discovery = true -> Cloud Map rolling service (backend).
#       Registers an A record (e.g. backend.pongapp.local) for east-west DNS.
# Each instance gets its own execution role, task role, and log group.
# ---------------------------------------------------------------------------

locals {
  full_name     = "${var.name_prefix}-${var.service_name}"
  log_group     = "/ecs/${var.name_prefix}-${var.service_name}"
  has_lb        = var.enable_blue_green
  has_discovery = var.enable_service_discovery
}

# ---- task execution role (pull image, write logs, read secrets) ----
data "aws_iam_policy_document" "task_exec_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_exec" {
  name               = "${local.full_name}-exec"
  assume_role_policy = data.aws_iam_policy_document.task_exec_trust.json
  tags               = { Name = "${local.full_name}-exec" }
}

resource "aws_iam_role_policy_attachment" "task_exec_managed" {
  role       = aws_iam_role.task_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Inline: read exactly the injected secret ARNs + ensure log stream creation.
data "aws_iam_policy_document" "task_exec_inline" {
  dynamic "statement" {
    for_each = length(var.secret_arns) > 0 ? [1] : []
    content {
      sid       = "ReadSecrets"
      effect    = "Allow"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = var.secret_arns
    }
  }

  statement {
    sid    = "Logs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.this.arn}:*"]
  }
}

resource "aws_iam_role_policy" "task_exec_inline" {
  name   = "secrets-and-logs"
  role   = aws_iam_role.task_exec.id
  policy = data.aws_iam_policy_document.task_exec_inline.json
}

# ---- task role (app runtime identity; minimal by default) ----
resource "aws_iam_role" "task" {
  name               = "${local.full_name}-task"
  assume_role_policy = data.aws_iam_policy_document.task_exec_trust.json
  tags               = { Name = "${local.full_name}-task" }
}

# ---- logs ----
resource "aws_cloudwatch_log_group" "this" {
  name              = local.log_group
  retention_in_days = var.log_retention_days
  tags              = { Name = local.full_name }
}

# ---- task definition ----
resource "aws_ecs_task_definition" "this" {
  family                   = local.full_name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.task_exec.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = var.service_name
      image     = "${var.image_repo_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for k, v in var.environment : { name = k, value = tostring(v) }
      ]

      secrets = [
        for k, arn in var.secrets : { name = k, valueFrom = arn }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.this.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = var.service_name
        }
      }

      healthCheck = var.health_check_command == null ? null : {
        command     = var.health_check_command
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = { Name = local.full_name }
}

# ---- Cloud Map service (backend discovery mode only) ----
resource "aws_service_discovery_service" "this" {
  count = local.has_discovery ? 1 : 0
  name  = var.service_name

  dns_config {
    namespace_id   = var.namespace_id
    routing_policy = "MULTIVALUE"

    dns_records {
      type = "A"
      ttl  = 10
    }
  }

  # Presence of this block makes Cloud Map use ECS-reported (custom) health;
  # failure_threshold is deprecated (AWS forces 1) so it is intentionally omitted.
  health_check_custom_config {}

  tags = { Name = "${local.full_name}-discovery" }
}

# ---- ECS service ----
resource "aws_ecs_service" "this" {
  name            = local.full_name
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  health_check_grace_period_seconds = local.has_lb ? var.health_check_grace_period : null

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  # Blue/green (ALB) edge service.
  dynamic "deployment_controller" {
    for_each = local.has_lb ? [1] : []
    content {
      type = "ECS"
    }
  }

  dynamic "deployment_configuration" {
    for_each = local.has_lb ? [1] : []
    content {
      strategy             = "BLUE_GREEN"
      bake_time_in_minutes = var.bake_time_in_minutes
    }
  }

  dynamic "load_balancer" {
    for_each = local.has_lb ? [1] : []
    content {
      container_name   = var.service_name
      container_port   = var.container_port
      target_group_arn = var.blue_target_group_arn

      advanced_configuration {
        alternate_target_group_arn = var.green_target_group_arn
        production_listener_rule   = var.production_listener_rule_arn
        role_arn                   = var.bluegreen_role_arn
      }
    }
  }

  # Cloud Map (service discovery) rolling service.
  dynamic "service_registries" {
    for_each = local.has_discovery ? [1] : []
    content {
      registry_arn = aws_service_discovery_service.this[0].arn
    }
  }

  # ECS rewrites the task definition revision on each deploy.
  lifecycle {
    ignore_changes = [task_definition]
  }
}
