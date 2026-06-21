# ---------------------------------------------------------------------------
# ElastiCache Redis (single node). cache.t4g.micro for a cost-optimized stack.
# Encryption left off for dev parity with the EKS in-cluster Redis; flip on for
# prod-grade. Reachable only from the backend SG.
# ---------------------------------------------------------------------------

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "Redis cache for ${var.name_prefix}"

  engine         = "redis"
  engine_version = var.engine_version
  node_type      = var.node_type
  port           = 6379

  num_cache_clusters = 1 # single node (no replica) for cost

  subnet_group_name  = var.subnet_group_name
  security_group_ids = [var.redis_sg_id]

  transit_encryption_enabled = var.transit_encryption_enabled
  at_rest_encryption_enabled = var.at_rest_encryption_enabled

  automatic_failover_enabled = false
  apply_immediately          = true

  tags = { Name = "${var.name_prefix}-redis" }
}
