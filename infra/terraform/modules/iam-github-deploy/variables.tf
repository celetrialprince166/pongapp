variable "name_prefix" {
  description = "Prefix for the deploy role name (e.g. pongapp-prod)."
  type        = string
}

variable "github_org" {
  description = "GitHub account/org that owns the repo."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
}

variable "oidc_provider_arn" {
  description = "ARN of the existing GitHub OIDC provider (from the oidc module)."
  type        = string
}

variable "task_role_arns" {
  description = "Task execution + task role ARNs the deploy role may PassRole."
  type        = list(string)
}

variable "ecr_repo_arns" {
  description = "ECR repository ARNs the deploy role may pull from."
  type        = list(string)
}

variable "tfstate_bucket" {
  description = "S3 bucket holding the Terraform state."
  type        = string
}

variable "tfstate_key" {
  description = "S3 key (path) of the Terraform state object."
  type        = string
}
