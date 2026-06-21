variable "name_prefix" {
  description = "Prefix for the DB identifier (e.g. pongapp-prod)."
  type        = string
}

variable "engine_version" {
  description = "PostgreSQL major engine version."
  type        = string
  default     = "17"
}

variable "instance_class" {
  description = "RDS instance class (cost-optimized default)."
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage" {
  description = "Allocated storage in GB."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "table_tennis_db"
}

variable "db_username" {
  description = "Master username."
  type        = string
  default     = "ttl_user"
}

variable "db_password" {
  description = "Master password (from the secrets module)."
  type        = string
  sensitive   = true
}

variable "db_subnet_group_name" {
  description = "DB subnet group name (from the network module)."
  type        = string
}

variable "rds_sg_id" {
  description = "Security group id for the RDS instance (from the network module)."
  type        = string
}

variable "multi_az" {
  description = "Enable Multi-AZ (off by default for cost)."
  type        = bool
  default     = false
}
