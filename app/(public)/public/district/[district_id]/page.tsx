'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, AlertTriangle, MapPin, BarChart3 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DistrictIndicator {
  indicatorId: number;
  projectName: string;
  indicatorName: string;
  physicalTarget: number;
  physicalAchievement: number;
  percentage: number;
  verifiedPercentage: number;
  verifiedDate: string | null;
  submittedDate: string | null;
}

export default function PublicDistrictPage() {
  const params = useParams();
  const router = useRouter();
  const districtId = Number(params.district_id as string);

  const [indicators, setIndicators] = useState<DistrictIndicator[] | null>(
    null,
  );
  const [districtName, setDistrictName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/public/district/${districtId}`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          districtName: string;
          indicators: DistrictIndicator[];
        };
        setDistrictName(json.districtName);
        setIndicators(json.indicators);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [districtId]);

  const stats = indicators
    ? {
      total: indicators.length,
      verified: indicators.filter((i) => i.verifiedDate).length,
      averageProgress:
        indicators.length > 0
          ? (
            indicators.reduce(
              (sum, i) => sum + (Number(i.verifiedPercentage) || 0),
              0,
            ) /
            indicators.length
          ).toFixed(1)
          : '0',
    }
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <KeralaHeader />

      <main className="container mx-auto flex-1 px-4 py-10">
        <Button
          variant="outline"
          size="sm"
          className="mb-6 cursor-pointer"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Overview
        </Button>

        {loading && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
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
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-error-red" />
              <p className="text-sm text-error-red">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && districtName && stats && (
          <>
            <div className="mb-8 space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-6 w-6 text-kerala-blue" />
                <h1 className="text-3xl font-bold text-foreground">
                  {districtName}
                </h1>
              </div>
              <p className="text-muted-foreground">
                Project indicators and progress for {districtName}
              </p>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Total Indicators
                    </p>
                    <p className="mt-2 text-3xl font-bold text-kerala-blue">
                      {stats.total}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Verified
                    </p>
                    <p className="mt-2 text-3xl font-bold text-success-green">
                      {stats.verified}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Avg Progress
                    </p>
                    <p className="mt-2 text-3xl font-bold text-amber-600">
                      {stats.averageProgress}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {indicators && indicators.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Indicators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Indicator</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Achievement</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {indicators.map((ind) => {
                          const verifiedPct = Number(ind.verifiedPercentage) || 0;

                          return (
                            <TableRow key={ind.indicatorId}>
                              <TableCell className="font-medium">
                                {ind.indicatorName}
                              </TableCell>
                              <TableCell className="text-sm">
                                {ind.projectName}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {ind.physicalTarget}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {ind.physicalAchievement}
                              </TableCell>
                              <TableCell>
                                <div className="w-24">
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="font-semibold">
                                      {verifiedPct.toFixed(0)}%
                                    </span>
                                  </div>
                                  <Progress
                                    value={Math.min(
                                      verifiedPct,
                                      100,
                                    )}
                                    className="h-1.5"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    ind.verifiedDate
                                      ? 'bg-success-green/90 text-white'
                                      : 'bg-warning-amber/90 text-white'
                                  }
                                >
                                  {ind.verifiedDate ? 'Verified' : 'Submitted'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {indicators && indicators.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <BarChart3 className="h-7 w-7 text-muted-foreground" />
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      No indicators found
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      No project indicators are assigned to this district yet.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
