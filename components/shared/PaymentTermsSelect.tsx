'use client';

import { useEffect, useMemo, useState } from 'react';
import { PO_OTHER_OPTION, resolvePOOptionSelection } from '@/types/po';
import { useDropdownOptions } from '@/hooks/useDropdownOptions';

interface PaymentTermsSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  customPlaceholder?: string;
}

export default function PaymentTermsSelect({
  value,
  onChange,
  disabled = false,
  id = 'payment_terms',
  placeholder = 'Select terms...',
  customPlaceholder = 'Enter payment terms...',
}: PaymentTermsSelectProps) {
  const { options: ptOpts } = useDropdownOptions('PAYMENT_TERMS_OPTIONS');
  const ptValues = useMemo(() => ptOpts.map(o => o.option_value), [ptOpts]);

  const resolved = useMemo(
    () => resolvePOOptionSelection(value, ptValues.length > 0 ? ptValues : [PO_OTHER_OPTION]),
    [value, ptValues],
  );
  const [sel, setSel] = useState(resolved.sel);
  const [custom, setCustom] = useState(resolved.custom);

  useEffect(() => {
    setSel(resolved.sel);
    setCustom(resolved.custom);
  }, [resolved.sel, resolved.custom]);

  return (
    <div className="space-y-2">
      <select
        id={id}
        value={sel}
        onChange={(e) => {
          const next = e.target.value;
          setSel(next);
          onChange(next === PO_OTHER_OPTION ? custom.trim() : next);
        }}
        disabled={disabled}
        required={sel !== PO_OTHER_OPTION}
        className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white disabled:opacity-60"
      >
        <option value="">{placeholder}</option>
        {ptValues.map((term) => (
          <option key={term} value={term}>
            {term}
          </option>
        ))}
      </select>
      {sel === PO_OTHER_OPTION && (
        <input
          type="text"
          value={custom}
          onChange={(e) => {
            const nextCustom = e.target.value;
            setCustom(nextCustom);
            onChange(nextCustom.trim());
          }}
          placeholder={customPlaceholder}
          disabled={disabled}
          required
          className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-60"
        />
      )}
    </div>
  );
}
