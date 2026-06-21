# ---------------------------------------------------------------------------
# Managed PostgreSQL (RDS). Single-AZ + db.t4g.micro for a cost-optimized dev/
# benchmark stack. Private only; reachable solely from the backend SG. Password
# is sourced from the secrets module (never in code).
# ---------------------------------------------------------------------------

resource "aws_db_instance" "this" {
  identifier     = "${var.name_prefix}-postgres"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432

  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [var.rds_sg_id]
  multi_az               = var.multi_az
  publicly_accessible    = false

  backup_retention_period = 1
  skip_final_snapshot     = true # dev/benchmark: no final snapshot on destroy
  deletion_protection     = false

  tags = { Name = "${var.name_prefix}-postgres" }
}
