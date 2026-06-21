variable "name_prefix" {
  description = "Prefix for ALB resource names (e.g. pongapp-prod)."
  type        = string
}

variable "vpc_id" {
  description = "VPC id (for target groups)."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet ids for the internet-facing ALB."
  type        = list(string)
}

variable "alb_sg_id" {
  description = "ALB security group id (from the network module)."
  type        = string
}
