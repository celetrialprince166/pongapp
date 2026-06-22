terraform {
  backend "s3" {
    bucket       = "pongapp-tfstate-648637468459-euw1"
    key          = "pongapp/ecs/prod/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true # native S3 state locking (writes <key>.tflock); no DynamoDB
  }
}
