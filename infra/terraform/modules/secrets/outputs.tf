output "db_password_secret_arn" {
  description = "Secrets Manager ARN of the RDS master password (for task-def valueFrom)."
  value       = aws_secretsmanager_secret.db_password.arn
}

output "django_secret_key_secret_arn" {
  description = "Secrets Manager ARN of the Django SECRET_KEY (for task-def valueFrom)."
  value       = aws_secretsmanager_secret.django_secret_key.arn
}

output "db_password" {
  description = "Generated RDS master password (passed directly to aws_db_instance)."
  value       = random_password.db.result
  sensitive   = true
}

output "secret_arns" {
  description = "All secret ARNs the task execution role must be allowed to read."
  value = [
    aws_secretsmanager_secret.db_password.arn,
    aws_secretsmanager_secret.django_secret_key.arn,
  ]
}
