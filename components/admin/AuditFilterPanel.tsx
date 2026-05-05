'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import type { AuditLogFilters } from '@/types/audit';

interface AuditFilterPanelProps {
  document_types: string[];
  actions: string[];
  onFilter: (filters: AuditLogFilters) => void;
  onRowsPerPageChange?: (limit: number) => void;
  rowsPerPage?: number;
  isLoading?: boolean;
}

export default function AuditFilterPanel({
  document_types,
  actions,
  onFilter,
  onRowsPerPageChange,
  rowsPerPage = 20,
  isLoading = false,
}: AuditFilterPanelProps) {
  const [action, setAction] = useState('');
  const [documentType, setDocumentType] = useState('all_document_types');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [localRowsPerPage, setLocalRowsPerPage] = useState(rowsPerPage.toString());

  const handleFilter = () => {
    onFilter({
      action: action || undefined,
      document_type: documentType === 'all_document_types' ? undefined : documentType || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  };

  const handleClear = () => {
    setAction('');
    setDocumentType('all_document_types');
    setDateFrom('');
    setDateTo('');
    onFilter({});
  };

  const handleRowsPerPageChange = (value: string) => {
    setLocalRowsPerPage(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && onRowsPerPageChange) {
      onRowsPerPageChange(numValue);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#E5EAFF] p-6 space-y-4">
      <h3 className="font-semibold text-[#0F1F3A] mb-4">Filters</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Action Search */}
        <div className="space-y-2">
          <Label htmlFor="action" className="text-xs font-medium text-[#40527A]">
            Action
          </Label>
          <Input
            id="action"
            placeholder="Search action..."
            value={action}
            onChange={(e) => setAction(e.target.value)}
            disabled={isLoading}
            className="text-sm"
          />
        </div>

        {/* Document Type */}
        <div className="space-y-2">
          <Label htmlFor="doc-type" className="text-xs font-medium text-[#40527A]">
            Document Type
          </Label>
          <Select value={documentType} onValueChange={setDocumentType} disabled={isLoading}>
            <SelectTrigger id="doc-type" className="text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_document_types">All types</SelectItem>
              {document_types.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date From */}
        <div className="space-y-2">
          <Label htmlFor="date-from" className="text-xs font-medium text-[#40527A]">
            From
          </Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            disabled={isLoading}
            className="text-sm"
          />
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label htmlFor="date-to" className="text-xs font-medium text-[#40527A]">
            To
          </Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            disabled={isLoading}
            className="text-sm"
          />
        </div>

        {/* Rows Per Page */}
        <div className="space-y-2">
          <Label htmlFor="rows-per-page" className="text-xs font-medium text-[#40527A]">
            Rows per page
          </Label>
          <Select value={localRowsPerPage} onValueChange={handleRowsPerPageChange} disabled={isLoading}>
            <SelectTrigger id="rows-per-page" className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleFilter}
          disabled={isLoading}
          className="bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-medium"
        >
          Apply Filters
        </Button>
        <Button
          onClick={handleClear}
          disabled={isLoading}
          variant="outline"
          className="text-xs font-medium"
        >
          <X className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
    </div>
  );
}
