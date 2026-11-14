create table if not exists public.benches (
  id text primary key,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null default 'Bench',
  note text not null default '' check (char_length(note) <= 1000),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete cascade
);

create table if not exists public.bench_reviews (
  id text primary key,
  bench_id text not null references public.benches (id) on delete cascade,
  author text not null default 'Anonymous' check (char_length(author) <= 80),
  rating smallint not null check (rating between 1 and 5),
  text text not null default '' check (char_length(text) <= 500),
  photo_paths text[] not null default '{}'
    check (cardinality(photo_paths) <= 3),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete cascade
);

create index if not exists benches_created_at_idx
  on public.benches (created_at desc);
create index if not exists benches_location_idx
  on public.benches (lat, lng);
create index if not exists bench_reviews_bench_created_at_idx
  on public.bench_reviews (bench_id, created_at desc);

alter table public.benches enable row level security;
alter table public.bench_reviews enable row level security;

drop policy if exists "Anyone can read benches" on public.benches;
create policy "Anyone can read benches"
  on public.benches for select to anon, authenticated
  using (true);

drop policy if exists "Anonymous users can add benches" on public.benches;
create policy "Anonymous users can add benches"
  on public.benches for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

drop policy if exists "Owners can update benches" on public.benches;
create policy "Owners can update benches"
  on public.benches for update to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

drop policy if exists "Owners can delete benches" on public.benches;
create policy "Owners can delete benches"
  on public.benches for delete to authenticated
  using (
    created_by = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

drop policy if exists "Anyone can read bench reviews" on public.bench_reviews;
create policy "Anyone can read bench reviews"
  on public.bench_reviews for select to anon, authenticated
  using (true);

drop policy if exists "Anonymous users can add reviews" on public.bench_reviews;
create policy "Anonymous users can add reviews"
  on public.bench_reviews for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

drop policy if exists "Owners can update reviews" on public.bench_reviews;
create policy "Owners can update reviews"
  on public.bench_reviews for update to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

drop policy if exists "Owners can delete reviews" on public.bench_reviews;
create policy "Owners can delete reviews"
  on public.bench_reviews for delete to authenticated
  using (
    created_by = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

grant select on public.benches, public.bench_reviews to anon, authenticated;
grant insert, update, delete on public.benches, public.bench_reviews to authenticated;

create or replace function public.create_bench_with_first_review(
  p_bench jsonb,
  p_review jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null
    or (select auth.jwt() ->> 'is_anonymous') <> 'true' then
    raise exception 'Anonymous sign-in is required.';
  end if;

  insert into public.benches (
    id, name, kind, note, lat, lng, created_at, created_by
  )
  values (
    p_bench ->> 'id',
    p_bench ->> 'name',
    coalesce(p_bench ->> 'kind', 'Bench'),
    coalesce(p_bench ->> 'note', ''),
    (p_bench ->> 'lat')::double precision,
    (p_bench ->> 'lng')::double precision,
    coalesce((p_bench ->> 'created_at')::timestamptz, now()),
    current_user_id
  )
  on conflict (id) do update
    set name = excluded.name,
        kind = excluded.kind,
        note = excluded.note,
        lat = excluded.lat,
        lng = excluded.lng
    where public.benches.created_by = current_user_id;

  if not found then
    raise exception 'The bench id is already owned by another user.';
  end if;

  insert into public.bench_reviews (
    id, bench_id, author, rating, text, photo_paths, created_at, created_by
  )
  values (
    p_review ->> 'id',
    p_bench ->> 'id',
    coalesce(p_review ->> 'author', 'Anonymous'),
    (p_review ->> 'rating')::smallint,
    coalesce(p_review ->> 'text', ''),
    array(
      select jsonb_array_elements_text(
        coalesce(p_review -> 'photo_paths', '[]'::jsonb)
      )
    ),
    coalesce((p_review ->> 'created_at')::timestamptz, now()),
    current_user_id
  )
  on conflict (id) do update
    set author = excluded.author,
        rating = excluded.rating,
        text = excluded.text,
        photo_paths = excluded.photo_paths
    where public.bench_reviews.created_by = current_user_id
      and public.bench_reviews.bench_id = excluded.bench_id;

  if not found then
    raise exception 'The review id is already owned by another user.';
  end if;
end;
$$;

revoke all on function public.create_bench_with_first_review(jsonb, jsonb)
  from public, anon;
grant execute on function public.create_bench_with_first_review(jsonb, jsonb)
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'bench-photos',
  'bench-photos',
  true,
  5242880,
  array['image/jpeg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read bench photos" on storage.objects;
create policy "Anyone can read bench photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'bench-photos');

drop policy if exists "Users can upload their bench photos" on storage.objects;
create policy "Users can upload their bench photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bench-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

drop policy if exists "Users can replace their bench photos" on storage.objects;
create policy "Users can replace their bench photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'bench-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'bench-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );

drop policy if exists "Users can delete their bench photos" on storage.objects;
create policy "Users can delete their bench photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bench-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.jwt() ->> 'is_anonymous') = 'true'
  );
