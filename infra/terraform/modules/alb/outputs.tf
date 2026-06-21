output "alb_dns_name" {
  description = "Public DNS name of the ALB (app entry point)."
  value       = aws_lb.this.dns_name
}

output "alb_arn" {
  value = aws_lb.this.arn
}

output "blue_tg_arn" {
  description = "Blue (active) target group ARN."
  value       = aws_lb_target_group.blue.arn
}

output "green_tg_arn" {
  description = "Green (alternate) target group ARN."
  value       = aws_lb_target_group.green.arn
}

output "http_listener_arn" {
  value = aws_lb_listener.http.arn
}

output "production_listener_rule_arn" {
  description = "Production listener rule ARN referenced by the ECS blue/green service."
  value       = aws_lb_listener_rule.production.arn
}

output "ecs_bluegreen_role_arn" {
  description = "ECS infrastructure role ARN used for blue/green LB traffic shifting."
  value       = aws_iam_role.ecs_bluegreen.arn
}
