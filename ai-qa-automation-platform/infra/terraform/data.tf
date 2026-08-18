# Data stores: KMS, S3, RDS Postgres, ElastiCache Redis
locals {
  prefix = "${var.project}-${var.environment}"
}

# --- KMS key for envelope-encrypting connector secrets ---
resource "aws_kms_key" "secrets" {
  description             = "QA platform connector secrets"
  enable_key_rotation     = true
  deletion_window_in_days = 7
  tags = { Name = "${local.prefix}-secrets" }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${local.prefix}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# --- S3 for traces / artifacts / Allure reports ---
resource "aws_s3_bucket" "artifacts" {
  bucket = "${local.prefix}-artifacts"
  tags   = { Name = "${local.prefix}-artifacts" }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.secrets.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- RDS Postgres (platform datastore) ---
resource "aws_db_subnet_group" "main" {
  name       = "${local.prefix}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "postgres" {
  identifier                = "${local.prefix}-db"
  engine                    = "postgres"
  engine_version            = "16.3"
  instance_class            = "db.t4g.small"
  allocated_storage         = 20
  storage_encrypted         = true
  db_name                   = "qaplatform"
  username                  = var.db_username
  password                  = var.db_password
  vpc_security_group_ids    = [aws_security_group.rds.id]
  db_subnet_group_name      = aws_db_subnet_group.main.name
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.prefix}-final"
  backup_retention_period   = 7
  tags = { Name = "${local.prefix}-db" }
}

# --- ElastiCache Redis (Celery broker / cache) ---
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.prefix}-redis-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${local.prefix}-redis"
  engine               = "redis"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  tags = { Name = "${local.prefix}-redis" }
}
