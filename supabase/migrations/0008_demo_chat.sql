-- Dev-only demo chat (mock mode) still talked about the old cast. Real users' messages are untouched.
with demo as (
  select c.id, row_number() over (order by c.created_at) as n
  from chat_messages c join users u on u.id = c.user_id
  where u.is_demo = true
)
update chat_messages m set content = case (demo.n - 1) % 4
  when 0 then 'tanner how much did you lose today'
  when 1 then 'jade roast my username'
  when 2 then 'is that couch even legal'
  else 'who actually pays rent here' end
from demo where m.id = demo.id;
