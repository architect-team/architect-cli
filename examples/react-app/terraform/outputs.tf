output "aurora_host" {
  value = module.postgres_db.cluster_endpoint
}

output "kubernetes_cluster_name" {
  value = module.eks.cluster_id
}
