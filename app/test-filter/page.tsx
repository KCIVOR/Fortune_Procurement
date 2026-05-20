'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import FilterBar from '@/components/shared/FilterBar';
import EmptyState from '@/components/shared/EmptyState';
import type { FilterConfig, TabFilter } from '@/components/shared/FilterBar.types';

/**
 * Test Page for FilterBar Component
 * 
 * Demonstrates all FilterBar capabilities:
 * - Tab filters (All, PR1, PR2, PO)
 * - Search input
 * - Select dropdowns
 * - Date filters
 * - Date range filters
 * - Result count display
 * - Loading states
 * 
 * This is a temporary page for demonstration purposes.
 * Delete after verification: DELETE /app/test-filter/page.tsx
 */

interface TestData {
  id: string;
  name: string;
  type: string;
  status: string;
  date: string;
}

const MOCK_DATA: TestData[] = [
  { id: '1', name: 'Purchase Request #001', type: 'PR1', status: 'Pending', date: '2026-05-15' },
  { id: '2', name: 'Purchase Request #002', type: 'PR2', status: 'Approved', date: '2026-05-14' },
  { id: '3', name: 'Purchase Order #001', type: 'PO', status: 'Pending', date: '2026-05-13' },
  { id: '4', name: 'Purchase Request #003', type: 'PR1', status: 'Rejected', date: '2026-05-12' },
  { id: '5', name: 'Purchase Request #004', type: 'PR2', status: 'Pending', date: '2026-05-11' },
  { id: '6', name: 'Purchase Order #002', type: 'PO', status: 'Approved', date: '2026-05-10' },
  { id: '7', name: 'Purchase Request #005', type: 'PR1', status: 'Approved', date: '2026-05-09' },
  { id: '8', name: 'Purchase Request #006', type: 'PR2', status: 'Pending', date: '2026-05-08' },
];

export default function TestFilterPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<string>('all');

  // Filter states
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Tab configuration
  const tabs: TabFilter[] = [
    { value: 'all', label: 'All' },
    { value: 'pr1', label: 'PR1' },
    { value: 'pr2', label: 'PR2' },
    { value: 'po', label: 'PO' },
  ];

  // Filter configuration
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'search',
      label: 'Search',
      placeholder: 'Search by name...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'status',
      label: 'Status',
      placeholder: 'Select status...',
      value: status,
      onChange: (value) => setStatus(value as string),
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
      ],
    },
    {
      type: 'date',
      id: 'dateFrom',
      label: 'Date From',
      value: dateFrom,
      onChange: (value) => setDateFrom(value as string),
    },
    {
      type: 'date',
      id: 'dateTo',
      label: 'Date To',
      value: dateTo,
      onChange: (value) => setDateTo(value as string),
    },
  ];

  // Filter logic
  const filteredData = MOCK_DATA.filter((item) => {
    // Tab filter
    if (activeTab !== 'all' && item.type.toLowerCase() !== activeTab) {
      return false;
    }

    // Search filter
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }

    // Status filter
    if (status && item.status.toLowerCase() !== status.toLowerCase()) {
      return false;
    }

    // Date range filter
    if (dateFrom && item.date < dateFrom) {
      return false;
    }
    if (dateTo && item.date > dateTo) {
      return false;
    }

    return true;
  });

  // Handlers
  const handleApply = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  const handleClear = () => {
    setSearch('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setActiveTab('all');
  };

  return (
    <div className="min-h-screen bg-pq-neutral-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <PageHeader
          title="FilterBar Component Test"
          description="Demonstration of all FilterBar capabilities. This is a temporary test page."
        />

        {/* FilterBar Component */}
        <div className="mt-8">
          <FilterBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            filters={filters}
            onApply={handleApply}
            onClear={handleClear}
            loading={loading}
            resultCount={filteredData.length}
            resultLabel="request"
          />
        </div>

        {/* Results Section */}
        <div className="mt-8">
          {filteredData.length > 0 ? (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-4 gap-4 px-6 py-3 bg-pq-neutral-50 border-b border-pq-neutral-200">
                <div className="text-xs font-semibold text-pq-neutral-600 uppercase tracking-wide">Name</div>
                <div className="text-xs font-semibold text-pq-neutral-600 uppercase tracking-wide">Type</div>
                <div className="text-xs font-semibold text-pq-neutral-600 uppercase tracking-wide">Status</div>
                <div className="text-xs font-semibold text-pq-neutral-600 uppercase tracking-wide">Date</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-pq-neutral-200">
                {filteredData.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4 hover:bg-pq-neutral-50 transition"
                  >
                    <div className="flex flex-col md:flex-row md:items-center">
                      <span className="md:hidden text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mr-2">
                        Name
                      </span>
                      <span className="text-sm text-pq-neutral-900 font-medium">{item.name}</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center">
                      <span className="md:hidden text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mr-2">
                        Type
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-pq-primary-100 text-pq-primary-700 text-xs font-semibold w-fit">
                        {item.type}
                      </span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center">
                      <span className="md:hidden text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mr-2">
                        Status
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold w-fit ${
                          item.status === 'Approved'
                            ? 'bg-pq-success-100 text-pq-success-700'
                            : item.status === 'Rejected'
                              ? 'bg-pq-error-100 text-pq-error-700'
                              : 'bg-pq-warning-100 text-pq-warning-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center">
                      <span className="md:hidden text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mr-2">
                        Date
                      </span>
                      <span className="text-sm text-pq-neutral-600">
                        {new Date(item.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No results found"
              description="Try adjusting your filters or search terms"
              icon="search"
            />
          )}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-pq-primary-50 border border-pq-primary-200 rounded-md p-6">
          <h3 className="text-sm font-semibold text-pq-primary-900 mb-3">Test Page Information</h3>
          <ul className="text-sm text-pq-primary-800 space-y-2">
            <li>✅ <strong>Tab Filters:</strong> Click "All", "PR1", "PR2", "PO" to filter by type</li>
            <li>✅ <strong>Search:</strong> Type in the search box to filter by name</li>
            <li>✅ <strong>Status Filter:</strong> Select a status from the dropdown</li>
            <li>✅ <strong>Date Filters:</strong> Use "Date From" and "Date To" to filter by date range</li>
            <li>✅ <strong>Apply Button:</strong> Click to simulate loading state (500ms)</li>
            <li>✅ <strong>Clear Button:</strong> Resets all filters and tabs</li>
            <li>✅ <strong>Result Count:</strong> Shows number of matching results</li>
            <li>✅ <strong>Responsive:</strong> Try resizing to see mobile layout</li>
          </ul>
          <p className="text-xs text-pq-primary-700 mt-4 italic">
            This is a temporary test page. Delete after verification: <code>DELETE /app/test-filter/page.tsx</code>
          </p>
        </div>
      </div>
    </div>
  );
}
