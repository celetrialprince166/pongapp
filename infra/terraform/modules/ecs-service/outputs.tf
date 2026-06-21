output "service_name" {
  description = "Full ECS service name."
  value       = aws_ecs_service.this.name
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.this.arn
}

output "task_exec_role_arn" {
  description = "Task execution role ARN (CI deploy role needs PassRole on this)."
  value       = aws_iam_role.task_exec.arn
}

output "task_role_arn" {
  description = "Task role ARN (CI deploy role needs PassRole on this)."
  value       = aws_iam_role.task.arn
}

output "log_group_name" {
  value = aws_cloudwatch_log_group.this.name
}
