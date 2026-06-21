variable "name_prefix" {
  description = "Prefix for the replication group id (e.g. pongapp-prod)."
  type        = string
}

variable "engine_version" {
  description = "Redis engine version."
  type        = string
  default     = "7.1"
}

variable "node_type" {
  description = "ElastiCache node type (cost-optimized default)."
  type        = string
  default     = "cache.t4g.micro"
}

variable "subnet_group_name" {
  description = "ElastiCache subnet group name (from the network module)."
  type        = string
}

variable "redis_sg_id" {
  description = "Security group id for Redis (from the network module)."
  type        = string
}

variable "transit_encryption_enabled" {
  description = "Enable in-transit encryption (off by default for dev)."
  type        = bool
  default     = false
}

variable "at_rest_encryption_enabled" {
  description = "Enable at-rest encryption (off by default for dev)."
  type        = bool
  default     = false
}
