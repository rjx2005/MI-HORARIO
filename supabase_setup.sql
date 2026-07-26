-- Copia y pega esto en Supabase: proyecto > SQL Editor > New query > Run

create table schedules (
  id text primary key,
  data jsonb,
  updated_at timestamptz default now()
);

alter table schedules enable row level security;

-- Permite que cualquiera lea y escriba su propio horario
-- (cada quien solo conoce y usa su propio id de dispositivo, generado en el navegador)
create policy "allow all access"
  on schedules
  for all
  using (true)
  with check (true);
