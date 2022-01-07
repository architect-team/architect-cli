SELECT "deployment"."created_at"                     AS "deployment_created_at",
       "deployment"."updated_at"                     AS "deployment_updated_at",
       "deployment"."deleted_at"                     AS "deployment_deleted_at",
       "deployment"."id"                             AS "deployment_id",
       "deployment"."instance_id"                    AS "deployment_instance_id"
       ,
       "deployment"."type"                           AS
       "deployment_type",
       "deployment"."action"                         AS "deployment_action",
       "deployment"."started_at"                     AS "deployment_started_at",
       "deployment"."failed_at"                      AS "deployment_failed_at",
       "deployment"."applied_at"                     AS "deployment_applied_at",
       "deployment"."aborted_at"                     AS "deployment_aborted_at",
       "deployment"."queued_at"                      AS "deployment_queued_at",
       "deployment"."build_id"                       AS "deployment_build_id",
       "deployment"."build_name"                     AS "deployment_build_name",
       "deployment"."metadata"                       AS "deployment_metadata",
       "deployment"."pipelineid"                     AS "deployment_pipelineId",
       "deployment"."componentversionid"             AS
       "deployment_componentVersionId",
       "component_version"."created_at"              AS
       "component_version_created_at",
       "component_version"."updated_at"              AS
       "component_version_updated_at",
       "component_version"."deleted_at"              AS
       "component_version_deleted_at",
       "component_version"."id"                      AS "component_version_id",
       "component_version"."tag"                     AS "component_version_tag",
       "component_version"."config"                  AS
       "component_version_config",
       "component_version"."componentid"             AS
       "component_version_componentId",
       "component"."created_at"                      AS "component_created_at",
       "component"."updated_at"                      AS "component_updated_at",
       "component"."deleted_at"                      AS "component_deleted_at",
       "component"."id"                              AS "component_id",
       "component"."name"                            AS "component_name",
       "component"."last_published"                  AS
       "component_last_published",
       "component"."metadata"                        AS "component_metadata",
       "component"."accountid"                       AS "component_accountId",
       "account"."created_at"                        AS "account_created_at",
       "account"."updated_at"                        AS "account_updated_at",
       "account"."deleted_at"                        AS "account_deleted_at",
       "account"."id"                                AS "account_id",
       "account"."name"                              AS "account_name",
       "account"."display_name"                      AS "account_display_name",
       "account"."description"                       AS "account_description",
       "account"."location"                          AS "account_location",
       "account"."website"                           AS "account_website",
       "account"."is_public"                         AS "account_is_public",
       "pipeline"."created_at"                       AS "pipeline_created_at",
       "pipeline"."updated_at"                       AS "pipeline_updated_at",
       "pipeline"."deleted_at"                       AS "pipeline_deleted_at",
       "pipeline"."id"                               AS "pipeline_id",
       "pipeline"."approved_at"                      AS "pipeline_approved_at",
       "pipeline"."failed_at"                        AS "pipeline_failed_at",
       "pipeline"."applied_at"                       AS "pipeline_applied_at",
       "pipeline"."environmentid"                    AS "pipeline_environmentId"
       ,
       "pipeline"."platformid"                       AS
       "pipeline_platformId",
       "pipeline"."createdbyid"                      AS "pipeline_createdById",
       "pipeline"."approvedbyid"                     AS "pipeline_approvedById",
       "environment"."created_at"                    AS "environment_created_at"
       ,
       "environment"."updated_at"                    AS
       "environment_updated_at",
       "environment"."deleted_at"                    AS "environment_deleted_at"
       ,
       "environment"."id"                            AS "environment_id"
       ,
       "environment"."name"                          AS
       "environment_name",
       "environment"."namespace"                     AS "environment_namespace",
       "environment"."description"                   AS
       "environment_description",
       "environment"."metadata"                      AS "environment_metadata",
       "environment"."platformid"                    AS "environment_platformId"
       ,
       "environment"."accountid"                     AS
       "environment_accountId",
       "environment_platform"."created_at"           AS
       "environment_platform_created_at",
       "environment_platform"."updated_at"           AS
       "environment_platform_updated_at",
       "environment_platform"."deleted_at"           AS
       "environment_platform_deleted_at",
       "environment_platform"."id"                   AS
       "environment_platform_id",
       "environment_platform"."name"                 AS
       "environment_platform_name",
       "environment_platform"."type"                 AS
       "environment_platform_type",
       "environment_platform"."description"          AS
       "environment_platform_description",
       "environment_platform"."properties"           AS
       "environment_platform_properties",
       "environment_platform"."flags"                AS
       "environment_platform_flags",
       "environment_platform"."accountid"            AS
       "environment_platform_accountId",
       "environment_platform_account"."created_at"   AS
       "environment_platform_account_created_at",
       "environment_platform_account"."updated_at"   AS
       "environment_platform_account_updated_at",
       "environment_platform_account"."deleted_at"   AS
       "environment_platform_account_deleted_at",
       "environment_platform_account"."id"           AS
       "environment_platform_account_id",
       "environment_platform_account"."name"         AS
       "environment_platform_account_name",
       "environment_platform_account"."display_name" AS
       "environment_platform_account_display_name",
       "environment_platform_account"."description"  AS
       "environment_platform_account_description",
       "environment_platform_account"."location"     AS
       "environment_platform_account_location",
       "environment_platform_account"."website"      AS
       "environment_platform_account_website",
       "environment_platform_account"."is_public"    AS
       "environment_platform_account_is_public",
       "environment_account"."created_at"            AS
       "environment_account_created_at",
       "environment_account"."updated_at"            AS
       "environment_account_updated_at",
       "environment_account"."deleted_at"            AS
       "environment_account_deleted_at",
       "environment_account"."id"                    AS "environment_account_id"
       ,
       "environment_account"."name"                  AS
       "environment_account_name",
       "environment_account"."display_name"          AS
       "environment_account_display_name",
       "environment_account"."description"           AS
       "environment_account_description",
       "environment_account"."location"              AS
       "environment_account_location",
       "environment_account"."website"               AS
       "environment_account_website",
       "environment_account"."is_public"             AS
       "environment_account_is_public"
FROM   (SELECT DISTINCT ON ("deployment"."instance_id") deployment.*
        FROM   "deployment" "deployment"
               LEFT JOIN "pipeline" "pipeline"
                      ON "pipeline"."id" = "deployment"."pipelineid"
                         AND ( "pipeline"."deleted_at" IS NULL )
        WHERE  ( pipeline."environmentid" = :environment_id
                 AND "deployment"."queued_at" IS NOT NULL
                 AND ( "deployment"."started_at" IS NOT NULL
                        OR "deployment"."failed_at" IS NULL ) )
               AND ( "deployment"."deleted_at" IS NULL )
        ORDER  BY deployment."instance_id" DESC,
                  "deployment"."queued_at" DESC) "deployment"
       LEFT JOIN "component_version" "component_version"
              ON "component_version"."id" = "deployment"."componentversionid"
                 AND ( "component_version"."deleted_at" IS NULL )
       LEFT JOIN "component" "component"
              ON "component"."id" = "component_version"."componentid"
                 AND ( "component"."deleted_at" IS NULL )
       LEFT JOIN "account" "account"
              ON "account"."id" = "component"."accountid"
                 AND ( "account"."deleted_at" IS NULL )
       LEFT JOIN "pipeline" "pipeline"
              ON "pipeline"."id" = "deployment"."pipelineid"
                 AND ( "pipeline"."deleted_at" IS NULL )
       LEFT JOIN "environment" "environment"
              ON "environment"."id" = "pipeline"."environmentid"
                 AND ( "environment"."deleted_at" IS NULL )
       LEFT JOIN "platform" "environment_platform"
              ON "environment_platform"."id" = "environment"."platformid"
                 AND ( "environment_platform"."deleted_at" IS NULL )
       LEFT JOIN "account" "environment_platform_account"
              ON "environment_platform_account"."id" =
                 "environment_platform"."accountid"
                 AND ( "environment_platform_account"."deleted_at" IS NULL )
       LEFT JOIN "account" "environment_account"
              ON "environment_account"."id" = "environment"."accountid"
                 AND ( "environment_account"."deleted_at" IS NULL )
WHERE  ( "deployment"."action" != 'delete'
          OR "deployment"."applied_at" IS NULL )
ORDER  BY "deployment"."queued_at" DESC
