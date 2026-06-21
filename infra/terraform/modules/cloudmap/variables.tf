variable "name_prefix" {
  description = "Prefix used in descriptions/tags (e.g. pongapp-prod)."
  type        = string
}

variable "namespace_name" {
  description = "Private DNS namespace name (e.g. pongapp.local)."
  type        = string
  default     = "pongapp.local"
}

variable "vpc_id" {
  description = "VPC the namespace is associated with."
  type        = string
}
