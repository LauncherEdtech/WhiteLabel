# infra/environments/production.tfvars
environment       = "production"
aws_region        = "sa-east-1"
domain_name       = "plataforma.com"
db_instance_class = "db.t3.medium"
api_desired_count = 2

# Preencher via CI/CD secrets:
# db_password      = ""
# redis_auth_token = ""
# secret_key       = ""
# jwt_secret_key   = ""
# api_image        = ""
# frontend_image   = ""
