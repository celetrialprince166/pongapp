locals {
  name_prefix = "${var.project}-${var.environment}" # pongapp-prod
}

module "network" {
  source = "../../modules/network"

  name_prefix               = local.name_prefix
  vpc_cidr                  = var.vpc_cidr
  azs                       = var.azs
  public_subnet_cidrs       = var.public_subnet_cidrs
  private_app_subnet_cidrs  = var.private_app_subnet_cidrs
  private_data_subnet_cidrs = var.private_data_subnet_cidrs
}

module "ecr" {
  source = "../../modules/ecr"

  project      = var.project
  repositories = ["frontend", "backend"]
}

module "github_oidc" {
  source = "../../modules/iam-github-oidc"

  name_prefix   = local.name_prefix
  github_org    = var.github_org
  github_repo   = var.github_repo
  ecr_repo_arns = module.ecr.repository_arns
}
