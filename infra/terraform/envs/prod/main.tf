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

# ---------------------------------------------------------------------------
# App infrastructure (ECS Fargate stack)
# ---------------------------------------------------------------------------

module "secrets" {
  source      = "../../modules/secrets"
  name_prefix = local.name_prefix
}

module "rds" {
  source = "../../modules/rds"

  name_prefix          = local.name_prefix
  db_password          = module.secrets.db_password
  db_subnet_group_name = module.network.db_subnet_group_name
  rds_sg_id            = module.network.rds_sg_id
  multi_az             = var.rds_multi_az
}

module "elasticache" {
  source = "../../modules/elasticache"

  name_prefix       = local.name_prefix
  subnet_group_name = module.network.elasticache_subnet_group_name
  redis_sg_id       = module.network.redis_sg_id
}

module "cloudmap" {
  source = "../../modules/cloudmap"

  name_prefix = local.name_prefix
  vpc_id      = module.network.vpc_id
}

module "alb" {
  source = "../../modules/alb"

  name_prefix       = local.name_prefix
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  alb_sg_id         = module.network.alb_sg_id
}

module "ecs_cluster" {
  source      = "../../modules/ecs-cluster"
  name_prefix = local.name_prefix
}

# Backend: Cloud Map rolling service at backend.pongapp.local
module "backend" {
  source = "../../modules/ecs-service"

  name_prefix       = local.name_prefix
  service_name      = "backend"
  aws_region        = var.aws_region
  cluster_arn       = module.ecs_cluster.cluster_arn
  image_repo_url    = module.ecr.repository_urls["backend"]
  image_tag         = var.backend_image_tag
  container_port    = 8000
  cpu               = var.backend_cpu
  memory            = var.backend_memory
  desired_count     = var.backend_desired_count
  subnet_ids        = module.network.private_app_subnet_ids
  security_group_id = module.network.backend_sg_id

  environment = {
    USE_POSTGRES                = "True"
    DJANGO_DEBUG                = "False"
    DJANGO_ALLOWED_HOSTS        = "*"
    DJANGO_CSRF_TRUSTED_ORIGINS = "http://${module.alb.alb_dns_name}"
    CORS_ALLOWED_ORIGINS        = "http://${module.alb.alb_dns_name}"
    REDIS_HOST                  = module.elasticache.primary_endpoint_address
    REDIS_PORT                  = tostring(module.elasticache.port)
    POSTGRES_HOST               = module.rds.address
    DB_HOST                     = module.rds.address
    DB_PORT                     = tostring(module.rds.port)
    DB_NAME                     = module.rds.db_name
    DB_USER                     = "ttl_user"
  }

  secrets = {
    DB_PASSWORD       = module.secrets.db_password_secret_arn
    DJANGO_SECRET_KEY = module.secrets.django_secret_key_secret_arn
  }
  secret_arns = module.secrets.secret_arns

  health_check_command = ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:8000/api/health/ || exit 1"]

  enable_service_discovery = true
  namespace_id             = module.cloudmap.namespace_id
}

# Frontend: ALB blue/green edge service
module "frontend" {
  source = "../../modules/ecs-service"

  name_prefix       = local.name_prefix
  service_name      = "frontend"
  aws_region        = var.aws_region
  cluster_arn       = module.ecs_cluster.cluster_arn
  image_repo_url    = module.ecr.repository_urls["frontend"]
  image_tag         = var.frontend_image_tag
  container_port    = 80
  cpu               = var.frontend_cpu
  memory            = var.frontend_memory
  desired_count     = var.frontend_desired_count
  subnet_ids        = module.network.private_app_subnet_ids
  security_group_id = module.network.frontend_sg_id

  environment = {
    BACKEND_HOST     = "backend.${module.cloudmap.namespace_name}"
    BACKEND_PORT     = "8000"
    BACKEND_RESOLVER = "169.254.169.253" # Amazon-provided VPC DNS (re-resolves Cloud Map)
  }

  health_check_command = ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:80/ || exit 1"]

  enable_blue_green            = true
  blue_target_group_arn        = module.alb.blue_tg_arn
  green_target_group_arn       = module.alb.green_tg_arn
  production_listener_rule_arn = module.alb.production_listener_rule_arn
  bluegreen_role_arn           = module.alb.ecs_bluegreen_role_arn
  bake_time_in_minutes         = var.bake_time_in_minutes
}

# GitHub Actions deploy role (reuses the OIDC provider from github_oidc)
module "github_deploy" {
  source = "../../modules/iam-github-deploy"

  name_prefix       = local.name_prefix
  github_org        = var.github_org
  github_repo       = var.github_repo
  oidc_provider_arn = module.github_oidc.oidc_provider_arn
  ecr_repo_arns     = module.ecr.repository_arns
  task_role_arns = [
    module.backend.task_exec_role_arn,
    module.backend.task_role_arn,
    module.frontend.task_exec_role_arn,
    module.frontend.task_role_arn,
  ]
  tfstate_bucket = "pongapp-tfstate-648637468459-euw1"
  tfstate_key    = "pongapp/ecs/prod/terraform.tfstate"
}
