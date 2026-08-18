output "api_url" {
  value = "http://${aws_lb.main.dns_name}/api/v1"
}

output "web_url" {
  value = "http://${aws_lb.main.dns_name}"
}

output "database_endpoint" {
  value     = aws_db_instance.postgres.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "kms_key_arn" {
  value = aws_kms_key.secrets.arn
}

output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}
