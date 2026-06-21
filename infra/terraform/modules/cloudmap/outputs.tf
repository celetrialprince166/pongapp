output "namespace_id" {
  description = "Cloud Map namespace id (passed to ecs-service for registration)."
  value       = aws_service_discovery_private_dns_namespace.this.id
}

output "namespace_arn" {
  value = aws_service_discovery_private_dns_namespace.this.arn
}

output "namespace_name" {
  description = "Namespace DNS name (e.g. pongapp.local)."
  value       = aws_service_discovery_private_dns_namespace.this.name
}
