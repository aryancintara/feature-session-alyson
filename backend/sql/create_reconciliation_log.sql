CREATE TABLE unified.reconciliation_log (
  id string,
  source_id string,
  period_kind string,
  date_reconciled date,
  period_start date,
  period_end date,
  checked_at timestamp,
  result string,
  source_leads int,
  loaded_leads int,
  source_revenue decimal(18,2),
  loaded_revenue decimal(18,2),
  difference decimal(18,2),
  how string,
  locked boolean,
  workspace_id string,
  missing_leads int,
  missing_lead_ids string
)
LOCATION 's3://datalake-unified-221490242148-us-west-2/reconciliation_log'
TBLPROPERTIES ('table_type'='ICEBERG', 'format'='parquet', 'write_compression'='zstd')
