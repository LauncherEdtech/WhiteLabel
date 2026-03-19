# infra/environments/production.tfvars
environment       = "production"
aws_region        = "sa-east-1"
domain_name       = "plataforma.com"
db_instance_class = "db.t3.medium"
api_desired_count = 2

# Preencher via CI/CD secrets:
# db_password      = "22092021Dd$"
# redis_auth_token = "16fef7b186c1553f7bdc709314a437633a96b40b2d482aa5a5742f4ddd8a487e"
# secret_key       = "884108b7ef79d0056ebdcd59ca55d72e840734eab80d68af20619f056992545f"
# jwt_secret_key   = "fab8b771fcb9e9d6709afc03efadb652d391112ebb74b6a4708b1be837b28672"
# api_image        = "AIzaSyB39WtkQJ9e8_lPFgEZgWul3h_ZhQIGgDY"
# frontend_image   = ""