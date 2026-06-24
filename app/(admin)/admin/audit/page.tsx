'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/audit?limit=${limit}&offset=${offset}&action=${filter}`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          logs: AuditLog[];
          total: number;
        };
        setLogs(json.logs);
        setTotal(json.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [filter, limit, offset]);

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
            View system activity and user actions
          </p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-2">
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted-foreground">
              Filter by Action
            </label>
            <Input
              placeholder="e.g., LOGIN_SUCCESS, INDICATOR_SUBMITTED"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setOffset(0);
              }}
              className="mt-1"
            />
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
                        {log.meta
                          ? JSON.stringify(log.meta).substring(0, 50).concat('...')
                          : '—'}
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
