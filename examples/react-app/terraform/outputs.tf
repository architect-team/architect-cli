output "postgres_host" {
  value = module.postgres_db.cluster_endpoint
}
