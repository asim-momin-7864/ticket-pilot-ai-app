do $$
declare
  t record;
  v_id uuid;
  v_ts timestamptz;
  v_draft text;
  v_final text;
begin
  -- reset: remove earlier seed rows (messages and events cascade)
  delete from public.tickets where customer_email like '%@seed.example';

  for t in
    select * from (values
      (1,  'Ava Martin',   'ava@seed.example',    'Password reset email never arrives',
           'I forgot my password and the reset email never came.',
           'REPLIED', 'HOW_TO', 'customer_care', 'normal', 0.95::real, 13,
           'Reset your password', 'approved', null::text),
      (2,  'Ben Carter',   'ben@seed.example',    'API returns 429 on Pro plan',
           'My script gets 429 errors on the Pro plan. What are the limits?',
           'REPLIED', 'HOW_TO', 'engineering', 'normal', 0.95, 11,
           'API rate limits and 429 errors', 'approved', null),
      (3,  'Chloe Nguyen', 'chloe@seed.example',  'How do I enable SSO?',
           'We are on the Pro plan and want to turn on single sign-on.',
           'REPLIED', 'HOW_TO', 'customer_care', 'normal', 0.93, 9,
           'Set up single sign-on (SSO)', 'edited', null),
      (4,  'Daniel Okafor','daniel@seed.example', 'Locked out after changing 2FA',
           'I changed my phone and now I cannot log in with my 2FA code.',
           'REPLIED', 'ERROR', 'customer_care', 'high', 0.88, 7,
           'Reset your password', 'edited', null),
      (5,  'Elena Rossi',  'elena@seed.example',  'Rate limit question for the API',
           'How many requests per minute can we send on our plan?',
           'REPLIED', 'HOW_TO', 'engineering', 'low', 0.97, 5,
           'API rate limits and 429 errors', 'approved', null),
      (6,  'Farid Khan',   'farid@seed.example',  'Cannot sign in to my workspace',
           'I cannot sign in. I think my password is wrong.',
           'RESOLVED', 'HOW_TO', 'customer_care', 'low', 0.91, 12,
           'Reset your password', 'approved', null),
      (7,  'Grace Lee',    'grace@seed.example',  'SSO setup for our team',
           'Can you explain how to configure SSO for our workspace?',
           'PENDING_REVIEW', 'HOW_TO', 'customer_care', 'normal', 0.94, 0,
           'Set up single sign-on (SSO)', null, null),
      (8,  'Hugo Silva',   'hugo@seed.example',   'Webhook calls fail with 429',
           'Our webhook integration keeps failing with 429 errors.',
           'PENDING_REVIEW', 'ERROR', 'engineering', 'high', 0.90, 0,
           'API rate limits and 429 errors', null, null),
      (9,  'Isha Patel',   'isha@seed.example',   'Password reset link expired',
           'The password reset link says it expired. What do I do?',
           'PENDING_REVIEW', 'HOW_TO', 'customer_care', 'normal', 0.96, 1,
           'Reset your password', null, null),
      (10, 'Jon Weber',    'jon@seed.example',    'Refund for my annual plan',
           'I want a refund for my annual plan, I stopped using it.',
           'ESCALATED', 'REFUND', 'billing', 'normal', 1.0, 4,
           null, null, 'risky_intent:REFUND'),
      (11, 'Kara Smith',   'kara@seed.example',   'Please cancel my subscription',
           'Cancel my subscription at the end of this month.',
           'ESCALATED', 'CANCELLATION', 'billing', 'normal', 1.0, 3,
           null, null, 'risky_intent:CANCELLATION'),
      (12, 'Liam Brown',   'liam@seed.example',   'Delete my personal data',
           'Please delete all my personal data from your systems.',
           'ESCALATED', 'PERSONAL_DATA', 'customer_care', 'high', 1.0, 2,
           null, null, 'risky_intent:PERSONAL_DATA'),
      (13, 'Mia Torres',   'mia@seed.example',    'Install the mobile app',
           'How do I install the mobile app on my phone?',
           'ESCALATED', 'HOW_TO', 'customer_care', 'low', 1.0, 6,
           null, null, 'no_kb_coverage'),
      (14, 'Noah Davis',   'noah@seed.example',   'Audit logs on the Business plan?',
           'Does the Business plan include audit logs for admins?',
           'ESCALATED', 'HOW_TO', 'customer_care', 'normal', 0.62, 1,
           'Set up single sign-on (SSO)', null, 'reviewer_escalated'),
      (15, 'Olivia Wright','olivia@seed.example', 'Dashboard is not loading',
           'The dashboard shows a blank page after I log in.',
           'FAILED', null, null, null, null, 0,
           null, null, null)
    ) as v(n, name, email, subject, body, status, intent, department,
           priority, confidence, days_ago, source_title, outcome, reason)
    order by n
  loop
    v_ts := now() - make_interval(days => t.days_ago, hours => t.n);

    insert into public.tickets
      (customer_name, customer_email, subject, status, intent, department,
       priority, confidence, escalation_reason, created_at, updated_at)
    values
      (t.name, t.email, t.subject, t.status, t.intent, t.department,
       t.priority, t.confidence,
       case when t.status = 'ESCALATED' then t.reason end,
       v_ts, v_ts + interval '3 hours')
    returning id into v_id;

    insert into public.ticket_messages (ticket_id, author_type, body, status, created_at)
    values (v_id, 'customer', t.body, 'sent', v_ts);

    insert into public.ticket_events (ticket_id, type, actor, payload, created_at)
    values (v_id, 'created', 'customer', '{"channel":"web"}', v_ts),
           (v_id, 'run_started', 'system', '{}', v_ts + interval '5 seconds');

    if t.status = 'FAILED' then
      insert into public.ticket_events (ticket_id, type, actor, payload, created_at)
      values (v_id, 'run_failed', 'system',
              '{"error":"classification failed"}', v_ts + interval '20 seconds');

    elsif t.status = 'ESCALATED' and t.reason <> 'reviewer_escalated' then
      if t.reason = 'no_kb_coverage' then
        insert into public.ticket_events (ticket_id, type, actor, payload, created_at)
        values (v_id, 'kb_gap', 'system',
                jsonb_build_object('query', t.subject, 'intent', t.intent),
                v_ts + interval '15 seconds');
      end if;
      insert into public.ticket_events (ticket_id, type, actor, payload, created_at)
      values (v_id, 'escalated', 'system',
              jsonb_build_object('reason', t.reason), v_ts + interval '20 seconds');

    else
      v_draft := 'Hi ' || split_part(t.name, ' ', 1) || E',\n\nThanks for reaching out about "'
        || t.subject || E'".\n\n1. Open the article "' || t.source_title
        || E'" in our help center.\n2. Follow the steps described there.\n'
        || E'3. If it still does not work, reply with details and we will investigate.\n\n'
        || 'Sources: ' || t.source_title || E'\n\nOrbitly Support';

      insert into public.ticket_messages
        (ticket_id, author_type, body, sources, status, created_at)
      values (v_id, 'ai_draft', v_draft,
              jsonb_build_array(jsonb_build_object(
                'id', gen_random_uuid(), 'title', t.source_title, 'section', 'Overview')),
              'draft', v_ts + interval '30 seconds');

      insert into public.ticket_events (ticket_id, type, actor, payload, created_at)
      values (v_id, 'draft_ready', 'system',
              jsonb_build_object('confidence', t.confidence,
                                 'citations', jsonb_build_array(t.source_title)),
              v_ts + interval '30 seconds');

      if t.status = 'ESCALATED' then
        insert into public.ticket_events (ticket_id, type, actor, payload, created_at)
        values (v_id, 'escalated', 'demo.staff@example.com',
                '{"reason":"reviewer_escalated"}', v_ts + interval '2 hours');

      elsif t.status in ('REPLIED', 'RESOLVED') then
        v_final := case when t.outcome = 'edited'
                        then v_draft || E'\n\nLet us know if you need anything else.'
                        else v_draft end;
        insert into public.ticket_events (ticket_id, type, actor, payload, created_at)
        values (v_id, t.outcome, 'demo.staff@example.com', '{}', v_ts + interval '2 hours');
        insert into public.ticket_messages (ticket_id, author_type, body, status, created_at)
        values (v_id, 'staff', v_final, 'sent', v_ts + interval '2 hours');
      end if;
    end if;
  end loop;
end $$;