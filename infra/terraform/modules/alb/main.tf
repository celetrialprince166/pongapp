# ---------------------------------------------------------------------------
# Public Application Load Balancer — the only internet-facing edge, fronting the
# frontend (nginx) service. Two target groups (blue/green) enable ECS-native
# blue/green deployments: ECS shifts traffic by rewriting the production
# listener rule between the two groups, so we ignore drift on the listener's
# default action and the rule's action.
# ---------------------------------------------------------------------------

resource "aws_lb" "this" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_sg_id]
  subnets            = var.public_subnet_ids

  tags = { Name = "${var.name_prefix}-alb" }
}

# Blue/green target groups for the frontend (target_type ip == Fargate awsvpc).
resource "aws_lb_target_group" "blue" {
  name        = "${var.name_prefix}-fe-blue"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "${var.name_prefix}-fe-blue" }
}

resource "aws_lb_target_group" "green" {
  name        = "${var.name_prefix}-fe-green"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = { Name = "${var.name_prefix}-fe-green" }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  # Default sends 404; the priority-1 rule below carries real traffic. ECS
  # blue/green rewrites the rule, so default_action only seeds initial state.
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }

  lifecycle {
    ignore_changes = [default_action]
  }
}

# Production listener rule referenced by the ECS blue/green deployment. ECS
# updates its action to shift traffic between blue and green, so ignore drift.
resource "aws_lb_listener_rule" "production" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.blue.arn
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  lifecycle {
    ignore_changes = [action]
  }

  tags = { Name = "${var.name_prefix}-fe-prod-rule" }
}

# ---------------------------------------------------------------------------
# ECS-managed infrastructure role for blue/green load-balancer traffic shifting.
# Assumed by ecs.amazonaws.com; AWS-managed policy scoped to ELB mutations.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "ecs_bluegreen_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_bluegreen" {
  name               = "${var.name_prefix}-ecs-bluegreen-lb"
  assume_role_policy = data.aws_iam_policy_document.ecs_bluegreen_trust.json
  tags               = { Name = "${var.name_prefix}-ecs-bluegreen-lb" }
}

resource "aws_iam_role_policy_attachment" "ecs_bluegreen" {
  role       = aws_iam_role.ecs_bluegreen.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonECSInfrastructureRolePolicyForLoadBalancers"
}
