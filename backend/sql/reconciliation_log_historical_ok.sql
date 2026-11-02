MERGE INTO unified.reconciliation_log t
USING (
  SELECT * FROM (
    VALUES
      (
        'homelight:2022-07-09:2026-11-01',
        'homelight',
        'range',
        DATE '2026-10-31',
        DATE '2022-07-09',
        DATE '2026-11-01',
        CAST(current_timestamp AS timestamp),
        'matched',
        89317,
        89317,
        DECIMAL '9596623.80',
        DECIMAL '9596623.80',
        DECIMAL '0.00',
        'historical load · all leads through 2026-10-31',
        true,
        '253',
        0,
        '[]'
      ),
      (
        'uct:2026-05-22:2026-10-29',
        'uct',
        'range',
        DATE '2026-10-28',
        DATE '2026-05-22',
        DATE '2026-10-29',
        CAST(current_timestamp AS timestamp),
        'matched',
        15018,
        15018,
        DECIMAL '114887.70',
        DECIMAL '114887.70',
        DECIMAL '0.00',
        'historical load · all leads through 2026-10-28',
        true,
        '253',
        0,
        '[]'
      ),
      (
        'phonexa:2025-10-03:2026-10-29',
        'phonexa',
        'range',
        DATE '2026-10-28',
        DATE '2025-10-03',
        DATE '2026-10-29',
        CAST(current_timestamp AS timestamp),
        'matched',
        18666,
        18666,
        DECIMAL '336659.02',
        DECIMAL '336659.02',
        DECIMAL '0.00',
        'historical load · all leads through 2026-10-28',
        true,
        '253',
        0,
        '[]'
      )
  ) AS v (
    id, source_id, period_kind, date_reconciled, period_start, period_end,
    checked_at, result, source_leads, loaded_leads, source_revenue, loaded_revenue,
    difference, how, locked, workspace_id, missing_leads, missing_lead_ids
  )
) s
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET
  period_kind = s.period_kind,
  date_reconciled = s.date_reconciled,
  period_start = s.period_start,
  period_end = s.period_end,
  checked_at = s.checked_at,
  result = s.result,
  source_leads = s.source_leads,
  loaded_leads = s.loaded_leads,
  source_revenue = s.source_revenue,
  loaded_revenue = s.loaded_revenue,
  difference = s.difference,
  how = s.how,
  locked = s.locked,
  missing_leads = s.missing_leads,
  missing_lead_ids = s.missing_lead_ids
WHEN NOT MATCHED THEN INSERT (
  id, source_id, period_kind, date_reconciled, period_start, period_end,
  checked_at, result, source_leads, loaded_leads, source_revenue, loaded_revenue,
  difference, how, locked, workspace_id, missing_leads, missing_lead_ids
) VALUES (
  s.id, s.source_id, s.period_kind, s.date_reconciled, s.period_start, s.period_end,
  s.checked_at, s.result, s.source_leads, s.loaded_leads, s.source_revenue, s.loaded_revenue,
  s.difference, s.how, s.locked, s.workspace_id, s.missing_leads, s.missing_lead_ids
)
