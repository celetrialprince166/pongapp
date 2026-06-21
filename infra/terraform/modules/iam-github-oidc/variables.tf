variable "name_prefix" {
  type = string
}

variable "github_org" {
  description = "GitHub account/org that owns the repo."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
}

variable "ecr_repo_arns" {
  description = "ECR repository ARNs the CI role may push to."
  type        = list(string)
}

variable "create_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set false if one already exists in the account."
  type        = bool
  default     = true
}
