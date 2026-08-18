variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "prod"
}

variable "project" {
  default = "qa-platform"
}

variable "db_username" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "web_image" {
  type = string
}

variable "api_image" {
  type = string
}

variable "web_url" {
  type    = string
  default = "http://localhost:3000"
}

variable "api_url" {
  type    = string
  default = "http://localhost:8000"
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "redis_url" {
  type = string
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "llm_provider" {
  type    = string
  default = "openrouter"
}

variable "llm_model" {
  type    = string
  default = ""
}

variable "llm_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "temporal_address" {
  type    = string
  default = "localhost:7233"
}
