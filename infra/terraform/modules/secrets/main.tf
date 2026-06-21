# ---------------------------------------------------------------------------
# Application secrets: generated at apply time (never in git), stored in
# Secrets Manager. The RDS master password is consumed by the rds module; both
# ARNs are injected into the backend task definition via `secrets`/`valueFrom`.
# ---------------------------------------------------------------------------

# DB master password — alphanumeric only (RDS rejects /, @, ", and spaces).
resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%^&*()-_=+[]{}"
}

resource "random_password" "django_secret_key" {
  length  = 50
  special = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name        = "${var.name_prefix}-db-password"
  description = "RDS PostgreSQL master password for ${var.name_prefix}."
  tags        = { Name = "${var.name_prefix}-db-password" }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "aws_secretsmanager_secret" "django_secret_key" {
  name        = "${var.name_prefix}-django-secret-key"
  description = "Django SECRET_KEY for ${var.name_prefix}."
  tags        = { Name = "${var.name_prefix}-django-secret-key" }
}

resource "aws_secretsmanager_secret_version" "django_secret_key" {
  secret_id     = aws_secretsmanager_secret.django_secret_key.id
  secret_string = random_password.django_secret_key.result
}
