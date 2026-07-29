create policy "Planning can delete own draft raw material PR2 requests"
on public.pr2_requests
for delete
using (
  requisitioner_id = auth.uid()
  and request_type = 'raw_material'
  and status = 'draft'
);
