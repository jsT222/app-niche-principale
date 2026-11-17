-- Liens vers les workflows n8n et durcissement des droits d'exécution
update automations set n8n_workflow_id = 'awRHOOvhmrgMJ0QP' where key = 'booking_confirmation';
update automations set n8n_workflow_id = 'lyxsWFBrldCplUoG' where key in ('reminder_j3', 'arrival_instructions_j1');
update automations set n8n_workflow_id = '31cKxgmghxngcLA5' where key = 'cancellation_handling';
update integration_settings set n8n_webhook_base = 'https://jst2.app.n8n.cloud/webhook/hotelis';

revoke execute on function public.log_automation(uuid, text, text, jsonb, run_status, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.notify_n8n(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.next_invoice_number(uuid) from public, anon, authenticated;
revoke execute on function public.create_booking(uuid, uuid, date, date, int, int, text, text, text, text, text, booking_channel, reservation_status, text, numeric) from public;
revoke execute on function public.execute_automation(uuid, boolean) from public;
revoke execute on function public.run_scheduled(text) from public;
revoke execute on function public.seed_demo() from public;
revoke execute on function public.seed_demo_hotel(uuid) from public;
revoke execute on function public.seed_demo_activity(uuid) from public;
revoke execute on function public.seed_demo_runs(uuid) from public;
revoke execute on function public.seed_spread_recent() from public;
revoke execute on function public.night_series(uuid[], date, date) from public;
revoke execute on function public.install_automations(uuid) from public, anon, authenticated;
grant execute on function public.log_automation(uuid, text, text, jsonb, run_status, uuid, timestamptz) to service_role;
