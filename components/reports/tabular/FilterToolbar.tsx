'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ReportFilters } from './types';

const VERIFICATION_OPTIONS = [
  { value: 'All', label: 'All Verification Status' },
  { value: 'Verified', label: 'Verified' },
  { value: 'Pending Verification', label: 'Pending Verification' },
  { value: 'No Update', label: 'No Update' },
];

const STATUS_OPTIONS = [
  { value: 'All', label: 'All Status' },
  { value: 'On Track', label: 'On Track' },
  { value: 'Lagging', label: 'Lagging' },
];

type FilterToolbarProps = {
  initial: ReportFilters;
  departmentOptions: string[];
  agencyOptions: string[];
  onApply: (filters: ReportFilters) => void;
  onClear: () => void;
};

export function FilterToolbar({ initial, departmentOptions, agencyOptions, onApply, onClear }: FilterToolbarProps) {
  const [search, setSearch] = useState(initial.search);
  const [department, setDepartment] = useState(initial.department);
  const [agency, setAgency] = useState(initial.agency);
  const [verification, setVerification] = useState(initial.verification);
  const [status, setStatus] = useState(initial.status);

  return (
    <div className="space-y-3 rounded-lg border bg-white p-3">
      <div className="relative w-full">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search departments, projects, indicators…"
          className="h-10 pl-9"
          aria-label="Search report rows"
        />
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="h-9 w-full md:w-52" aria-label="Filter by department">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Departments</SelectItem>
            {departmentOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={verification} onValueChange={setVerification}>
          <SelectTrigger className="h-9 w-full md:w-56" aria-label="Filter by verification status">
            <SelectValue placeholder="All Verification Status" />
          </SelectTrigger>
          <SelectContent>
            {VERIFICATION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={agency} onValueChange={setAgency}>
          <SelectTrigger className="h-9 w-full md:w-56" aria-label="Filter by implementing agency">
            <SelectValue placeholder="All Implementing Agencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Implementing Agencies</SelectItem>
            {agencyOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-full md:w-40" aria-label="Filter by status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2 md:ml-auto">
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear
          </Button>
          <Button size="sm" onClick={() => onApply({ search, department, agency, verification, status })}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
