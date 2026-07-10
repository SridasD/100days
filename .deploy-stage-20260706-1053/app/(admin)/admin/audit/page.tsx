'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AuditLog {
  logId: number;
  userId: number;
  userName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  outcome: string | null;
  recordedAt: string;
  meta: any;
  userAgent: string | null;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const buildDetails = (meta: unknown) => {
    if (meta == null) return 'No details';
    if (typeof meta === 'string') return meta;
    if (typeof meta === 'number' || typeof meta === 'boolean') {
      return String(meta);
    }
    try {
      return JSON.stringify(meta, null, 2);
    } catch {
      return 'Unable to parse details';
    }
  };

  const hasDetails = (meta: unknown, userAgent: string | null) => {
    const hasUserAgent = Boolean(userAgent && userAgent.trim());
    if (meta == null) return hasUserAgent;
    if (typeof meta === 'string') return meta.trim().length > 0 || hasUserAgent;
    if (typeof meta === 'number' || typeof meta === 'boolean') return true;
    if (Array.isArray(meta)) return meta.length > 0 || hasUserAgent;
    if (typeof meta === 'object') return Object.keys(meta as Record<string, unknown>).length > 0 || hasUserAgent;
    return hasUserAgent;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
        });

        if (search.trim()) params.set('q', search.trim());
        if (actionFilter.trim()) params.set('action', actionFilter.trim());
        if (entityFilter.trim()) params.set('entity', entityFilter.trim());
        if (outcomeFilter.trim()) params.set('outcome', outcomeFilter.trim());
        if (userIdFilter.trim()) params.set('userId', userIdFilter.trim());

        const res = await fetch(`/api/admin/audit?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          logs: AuditLog[];
          total: number;
          actions?: string[];
        };
        setLogs(json.logs);
        setTotal(json.total);
        setActionOptions(json.actions ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [search, actionFilter, entityFilter, outcomeFilter, userIdFilter, limit, offset]);

  const pages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const outcomes: Record<string, { icon: any; color: string }> = {
    success: {
      icon: Check,
      color: 'text-success-green',
    },
    failure: {
      icon: X,
      color: 'text-error-red',
    },
  };

  return (
    <main className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Search, filter, and inspect system activity in detail
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Search
            </label>
            <Input
              placeholder="User, action, entity, details"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setOffset(0);
              }}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Entity
            </label>
            <Input
              placeholder="user_details"
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setOffset(0);
              }}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Outcome
            </label>
            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setOffset(0);
              }}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILURE">FAILURE</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              User ID
            </label>
            <Input
              placeholder="e.g., 73"
              value={userIdFilter}
              onChange={(e) => {
                setUserIdFilter(e.target.value);
                setOffset(0);
              }}
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setActionFilter('');
                setEntityFilter('');
                setOutcomeFilter('');
                setUserIdFilter('');
                setOffset(0);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-4 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-error-red/30 bg-error-red/5">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-error-red" />
            <p className="text-sm text-error-red">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && logs && logs.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const outcome = outcomes[log.outcome?.toLowerCase() ?? ''];
                  const OutcomeIcon = outcome?.icon;

                  return (
                    <TableRow key={log.logId}>
                      <TableCell className="text-xs">
                        {new Date(log.recordedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.userName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.entity}
                        {log.entityId && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            #{log.entityId}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {OutcomeIcon && (
                          <OutcomeIcon className={`h-4 w-4 ${outcome.color}`} />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {hasDetails(log.meta, log.userAgent) ? (
                          <details className="group max-w-[360px]">
                            <summary className="cursor-pointer select-none text-xs font-medium text-foreground">
                              View details
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded-md border bg-muted/50 p-2 text-[11px] leading-relaxed text-foreground">
                              {buildDetails(log.meta)}
                            </pre>
                            {log.userAgent && (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                User Agent: {log.userAgent}
                              </p>
                            )}
                          </details>
                        ) : (
                          <span>—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {pages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pages}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {!loading && !error && (!logs || logs.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <AlertTriangle className="h-7 w-7 text-muted-foreground" />
            <div>
              <p className="text-base font-semibold text-foreground">
                No audit logs found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or check back later.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
