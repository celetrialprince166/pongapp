# ---------------------------------------------------------------------------
# AWS Cloud Map private DNS namespace for east-west (frontend -> backend)
# service discovery. The backend registers backend.pongapp.local here. Internal
# traffic uses DNS instead of an internal ALB: lower latency, no per-LB cost.
# The per-service aws_service_discovery_service lives in the ecs-service module.
# ---------------------------------------------------------------------------

resource "aws_service_discovery_private_dns_namespace" "this" {
  name        = var.namespace_name
  description = "Private service discovery namespace for ${var.name_prefix}"
  vpc         = var.vpc_id
  tags        = { Name = var.namespace_name }
}
