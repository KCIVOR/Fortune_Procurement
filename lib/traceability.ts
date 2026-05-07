import { supabase } from '@/lib/supabase';

const db = supabase as any;

export type ChainDocType = 'PR1' | 'RFQ' | 'PR2' | 'PO' | 'Delivery' | 'GRN';

export interface ChainPOLink {
  id: string;
  document_number: string;
  status: string | null;
  supplier_name_snapshot: string | null;
  route: string;
}

export interface ChainDoc {
  type: ChainDocType;
  id: string | null;
  document_number: string | null;
  status: string | null;
  route: string | null;
  exists: boolean;
  /** Multiple POs for the same PR2 (PR1/RFQ/PR2 anchors only). Omitted when a single PO or none. */
  linked_pos?: ChainPOLink[];
}

export type DocumentChain = ChainDoc[];

// ── Resolvers: fetch minimal id/number/status only, no pricing ────────────────

async function resolvePR1(id: string): Promise<ChainDoc> {
  const { data } = await db
    .from('pr1_requests')
    .select('id, pr1_number, status')
    .eq('id', id)
    .maybeSingle();
  if (!data) return { type: 'PR1', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'PR1', id: data.id, document_number: data.pr1_number, status: data.status, route: `/pr1/${data.id}`, exists: true };
}

async function resolveRFQByPR1(pr1Id: string): Promise<ChainDoc> {
  const { data } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status')
    .eq('pr1_id', pr1Id)
    .maybeSingle();
  if (!data) return { type: 'RFQ', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'RFQ', id: data.id, document_number: data.rfq_number, status: data.status, route: `/rfq/${data.id}`, exists: true };
}

async function resolveRFQById(rfqId: string): Promise<ChainDoc> {
  const { data } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status')
    .eq('id', rfqId)
    .maybeSingle();
  if (!data) return { type: 'RFQ', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'RFQ', id: data.id, document_number: data.rfq_number, status: data.status, route: `/rfq/${data.id}`, exists: true };
}

async function resolvePR2ByPR1(pr1Id: string): Promise<ChainDoc> {
  const { data } = await db
    .from('pr2_requests')
    .select('id, pr2_number, status')
    .eq('pr1_id', pr1Id)
    .maybeSingle();
  if (!data) return { type: 'PR2', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'PR2', id: data.id, document_number: data.pr2_number, status: data.status, route: `/pr2/${data.id}`, exists: true };
}

async function resolvePR2ByRFQ(rfqId: string): Promise<ChainDoc> {
  const { data } = await db
    .from('pr2_requests')
    .select('id, pr2_number, status')
    .eq('rfq_id', rfqId)
    .maybeSingle();
  if (!data) return { type: 'PR2', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'PR2', id: data.id, document_number: data.pr2_number, status: data.status, route: `/pr2/${data.id}`, exists: true };
}

async function resolvePR2ById(pr2Id: string): Promise<ChainDoc> {
  const { data } = await db
    .from('pr2_requests')
    .select('id, pr2_number, status')
    .eq('id', pr2Id)
    .maybeSingle();
  if (!data) return { type: 'PR2', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'PR2', id: data.id, document_number: data.pr2_number, status: data.status, route: `/pr2/${data.id}`, exists: true };
}

/** First PO id for this PR2 (e.g. to resolve Delivery when multiple POs exist). */
async function getFirstPOIdForPR2(pr2Id: string): Promise<string | null> {
  const { data } = await db
    .from('po_requests')
    .select('id')
    .eq('pr2_id', pr2Id)
    .order('generated_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** All PO rows for Related Records when viewing PR1 / RFQ / PR2 (not anchored on a specific PO). */
async function resolvePOsByPR2ForChain(pr2Id: string): Promise<ChainDoc> {
  const { data, error } = await db
    .from('po_requests')
    .select('id, po_number, status, supplier_name_snapshot')
    .eq('pr2_id', pr2Id)
    .order('generated_at', { ascending: true });
  if (error || !data?.length) {
    return { type: 'PO', id: null, document_number: null, status: null, route: null, exists: false };
  }
  if (data.length === 1) {
    const row = data[0];
    return {
      type:               'PO',
      id:                 row.id,
      document_number:    row.po_number,
      status:             row.status,
      route:              `/po/${row.id}`,
      exists:             true,
    };
  }
  const linked_pos = data.map((row: { id: string; po_number: string; status: string | null; supplier_name_snapshot: string | null }) => ({
    id:                     row.id as string,
    document_number:        row.po_number as string,
    status:                 (row.status as string) ?? null,
    supplier_name_snapshot: (row.supplier_name_snapshot as string) ?? null,
    route:                  `/po/${row.id}`,
  }));
  return {
    type:            'PO',
    id:              null,
    document_number: null,
    status:          null,
    route:           null,
    exists:          true,
    linked_pos,
  };
}

async function resolvePOById(poId: string): Promise<ChainDoc> {
  const { data } = await db
    .from('po_requests')
    .select('id, po_number, status')
    .eq('id', poId)
    .maybeSingle();
  if (!data) return { type: 'PO', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'PO', id: data.id, document_number: data.po_number, status: data.status, route: `/po/${data.id}`, exists: true };
}

async function resolveDeliveryByPO(poId: string): Promise<ChainDoc> {
  const { data } = await db
    .from('deliveries')
    .select('id, status')
    .eq('po_id', poId)
    .maybeSingle();
  if (!data) return { type: 'Delivery', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'Delivery', id: data.id, document_number: null, status: data.status, route: `/delivery/${data.id}`, exists: true };
}

async function resolveDeliveryById(deliveryId: string): Promise<ChainDoc> {
  const { data } = await db
    .from('deliveries')
    .select('id, status, po_id')
    .eq('id', deliveryId)
    .maybeSingle();
  if (!data) return { type: 'Delivery', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'Delivery', id: data.id, document_number: null, status: data.status, route: `/delivery/${data.id}`, exists: true };
}

async function resolveGRNByDelivery(deliveryId: string): Promise<ChainDoc> {
  const { data } = await db
    .from('grn_receipts')
    .select('id, grn_number, status')
    .eq('delivery_id', deliveryId)
    .maybeSingle();
  if (!data) return { type: 'GRN', id: null, document_number: null, status: null, route: null, exists: false };
  return { type: 'GRN', id: data.id, document_number: data.grn_number, status: data.status, route: `/grn/${data.id}`, exists: true };
}

// Fetch the po_id stored in a delivery row (needed for GRN → PO traversal)
async function getDeliveryPOId(deliveryId: string): Promise<string | null> {
  const { data } = await db
    .from('deliveries')
    .select('po_id')
    .eq('id', deliveryId)
    .maybeSingle();
  return data?.po_id ?? null;
}

// Fetch the pr2_id stored in a po_requests row (needed for PO → PR2 traversal)
async function getPOPR2Id(poId: string): Promise<string | null> {
  const { data } = await db
    .from('po_requests')
    .select('pr2_id')
    .eq('id', poId)
    .maybeSingle();
  return data?.pr2_id ?? null;
}

// Fetch the rfq_id and pr1_id stored in a pr2_requests row
async function getPR2Parents(pr2Id: string): Promise<{ pr1_id: string | null; rfq_id: string | null }> {
  const { data } = await db
    .from('pr2_requests')
    .select('pr1_id, rfq_id')
    .eq('id', pr2Id)
    .maybeSingle();
  return { pr1_id: data?.pr1_id ?? null, rfq_id: data?.rfq_id ?? null };
}

// ── Main chain builder ────────────────────────────────────────────────────────

export async function fetchDocumentChain(
  baseType: ChainDocType,
  baseId: string
): Promise<DocumentChain> {
  try {
    let pr1Id: string | null = null;
    let rfqId: string | null = null;
    let pr2Id: string | null = null;
    let poId: string | null = null;
    let deliveryId: string | null = null;

    // Resolve the known anchor and traverse up/down to fill in all IDs
    switch (baseType) {
      case 'PR1': {
        pr1Id = baseId;
        break;
      }
      case 'RFQ': {
        const { data: rfq } = await db.from('rfq_batches').select('id, pr1_id').eq('id', baseId).maybeSingle();
        if (rfq) { rfqId = rfq.id; pr1Id = rfq.pr1_id; }
        break;
      }
      case 'PR2': {
        const parents = await getPR2Parents(baseId);
        pr2Id = baseId;
        pr1Id = parents.pr1_id;
        rfqId = parents.rfq_id;
        break;
      }
      case 'PO': {
        const fetchedPR2Id = await getPOPR2Id(baseId);
        poId = baseId;
        if (fetchedPR2Id) {
          pr2Id = fetchedPR2Id;
          const parents = await getPR2Parents(fetchedPR2Id);
          pr1Id = parents.pr1_id;
          rfqId = parents.rfq_id;
        }
        break;
      }
      case 'Delivery': {
        deliveryId = baseId;
        const fetchedPOId = await getDeliveryPOId(baseId);
        if (fetchedPOId) {
          poId = fetchedPOId;
          const fetchedPR2Id = await getPOPR2Id(fetchedPOId);
          if (fetchedPR2Id) {
            pr2Id = fetchedPR2Id;
            const parents = await getPR2Parents(fetchedPR2Id);
            pr1Id = parents.pr1_id;
            rfqId = parents.rfq_id;
          }
        }
        break;
      }
      case 'GRN': {
        const { data: grn } = await db.from('grn_receipts').select('delivery_id').eq('id', baseId).maybeSingle();
        if (grn?.delivery_id) {
          deliveryId = grn.delivery_id;
          const fetchedPOId = await getDeliveryPOId(grn.delivery_id);
          if (fetchedPOId) {
            poId = fetchedPOId;
            const fetchedPR2Id = await getPOPR2Id(fetchedPOId);
            if (fetchedPR2Id) {
              pr2Id = fetchedPR2Id;
              const parents = await getPR2Parents(fetchedPR2Id);
              pr1Id = parents.pr1_id;
              rfqId = parents.rfq_id;
            }
          }
        }
        break;
      }
    }

    // Now resolve all forward links we don't already have
    if (pr1Id && !rfqId) {
      const rfq = await resolveRFQByPR1(pr1Id);
      if (rfq.exists) rfqId = rfq.id;
    }
    if (rfqId && !pr2Id) {
      const pr2 = await resolvePR2ByRFQ(rfqId);
      if (pr2.exists) pr2Id = pr2.id;
    } else if (pr1Id && !pr2Id) {
      const pr2 = await resolvePR2ByPR1(pr1Id);
      if (pr2.exists) pr2Id = pr2.id;
    }
    if (pr2Id && !poId) {
      const firstPoId = await getFirstPOIdForPR2(pr2Id);
      if (firstPoId) poId = firstPoId;
    }
    if (poId && !deliveryId) {
      const del = await resolveDeliveryByPO(poId);
      if (del.exists) deliveryId = del.id;
    }

    const emptyPO: ChainDoc = {
      type: 'PO',
      id: null,
      document_number: null,
      status: null,
      route: null,
      exists: false,
    };

    const poFromAnchor =
      baseType === 'PO' || baseType === 'Delivery' || baseType === 'GRN'
        ? (poId ? resolvePOById(poId) : Promise.resolve(emptyPO))
        : pr2Id
          ? resolvePOsByPR2ForChain(pr2Id)
          : Promise.resolve(emptyPO);

    // Build chain in order: PR1 → RFQ → PR2 → PO → Delivery → GRN
    const [pr1Doc, rfqDoc, pr2Doc, poDoc, deliveryDoc, grnDoc] = await Promise.all([
      pr1Id ? resolvePR1(pr1Id) : Promise.resolve({ type: 'PR1' as ChainDocType, id: null, document_number: null, status: null, route: null, exists: false }),
      rfqId ? resolveRFQById(rfqId) : Promise.resolve({ type: 'RFQ' as ChainDocType, id: null, document_number: null, status: null, route: null, exists: false }),
      pr2Id ? resolvePR2ById(pr2Id) : Promise.resolve({ type: 'PR2' as ChainDocType, id: null, document_number: null, status: null, route: null, exists: false }),
      poFromAnchor,
      deliveryId ? resolveDeliveryById(deliveryId) : Promise.resolve({ type: 'Delivery' as ChainDocType, id: null, document_number: null, status: null, route: null, exists: false }),
      deliveryId ? resolveGRNByDelivery(deliveryId) : Promise.resolve({ type: 'GRN' as ChainDocType, id: null, document_number: null, status: null, route: null, exists: false }),
    ]);

    return [pr1Doc, rfqDoc, pr2Doc, poDoc, deliveryDoc, grnDoc];
  } catch {
    // Fail silently — never crash the detail page for traceability issues
    return [
      { type: 'PR1', id: null, document_number: null, status: null, route: null, exists: false },
      { type: 'RFQ', id: null, document_number: null, status: null, route: null, exists: false },
      { type: 'PR2', id: null, document_number: null, status: null, route: null, exists: false },
      { type: 'PO', id: null, document_number: null, status: null, route: null, exists: false },
      { type: 'Delivery', id: null, document_number: null, status: null, route: null, exists: false },
      { type: 'GRN', id: null, document_number: null, status: null, route: null, exists: false },
    ];
  }
}
