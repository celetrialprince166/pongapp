variable "project" {
  description = "Project name; repos are named <project>-<repo>."
  type        = string
}

variable "repositories" {
  description = "ECR repository short names to create."
  type        = list(string)
  default     = ["frontend", "backend"]
}

variable "max_image_count" {
  description = "How many tagged images to retain per repo."
  type        = number
  default     = 15
}
