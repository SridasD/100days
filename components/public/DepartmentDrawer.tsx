'use client';

/**
 * Department drill-down — a right-side slide-over drawer (bottom-to-top on
 * small screens is skipped in favour of a full-width Sheet; see the
 * department-wise-landing-section plan). Two levels:
 *
 *   Department (passed in) -> Projects (fetched on open)
 *     -> click a project -> Indicators (fetched lazily, cached per project)
 *
 * Deliberately distinct from the existing Sector drill-down, which is a
 * full-page navigation to /public/sectors/[id] — this stays an overlay.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Images,
  Loader2,
  Search,
  Video,
  X,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { DepartmentRowData, DepartmentStatus } from './DepartmentRow';
import {
  ProjectGallery,
  type PublicProjectDocument,
  type PublicProjectImage,
  type PublicProjectVideo,
} from './ProjectGallery';

interface ApiProject {
  projectId: number;
  projectPublicId: string;
  projectCode: string | null;
  name: string;
  costInLakhs: number;
  indicatorsTotal: number;
  indicatorsCompleted: number;
  physicalPct: number;
  financialPct: number | null;
  status: DepartmentStatus;
  completionDate: string | null;
  imageCount: number;
  videoCount: number;
  documentCount: number;
}

interface DepartmentDetail {
  secId: number;
  departmentPublicId: string;
  nameMal: string;
  stats: { projects: number; completed: number; indicators: number; media: number };
  projects: ApiProject[];
}

interface ApiIndicator {
  indicatorId: number;
  name: string;
  unit: string;
  physicalTarget: number;
  physicalAchievement: number;
  financialPct: number | null;
  physicalPct: number;
  completedDate: string | null;
}

/** Full per-project payload from /api/public/project/[id] — cached once per
 * project so both the inline indicator expand and the media gallery reuse
 * the same fetch instead of hitting the API twice. */
interface ProjectDetailEntry {
  indicators: ApiIndicator[];
  images: PublicProjectImage[];
  videos: PublicProjectVideo[];
  documents: PublicProjectDocument[];
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_CHIP: Record<DepartmentStatus, { chip: string; dot: string; labelMal: string }> = {
  completed: { chip: 'bg-hdp-success/10 text-hdp-success', dot: 'bg-hdp-success', labelMal: 'പൂർത്തിയായി' },
  'in-progress': { chip: 'bg-hdp-warning/10 text-hdp-warning', dot: 'bg-hdp-warning', labelMal: 'പുരോഗതിയിൽ' },
  'not-started': { chip: 'bg-hdp-danger/10 text-hdp-danger', dot: 'bg-hdp-danger', labelMal: 'ആരംഭിച്ചിട്ടില്ല' },
};

export function DepartmentDrawer({
  department,
  open,
  onOpenChange,
}: {
  department: DepartmentRowData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [openProjectId, setOpenProjectId] = useState<number | null>(null);
  const [projectDetailCache, setProjectDetailCache] = useState<
    Record<number, ProjectDetailEntry | 'loading' | 'error'>
  >({});
  const [galleryProjectId, setGalleryProjectId] = useState<number | null>(null);
  // Radix's outside-click/focus dismiss handling for two independently
  // mounted Dialog.Root instances (this Sheet + the gallery Dialog below)
  // can cascade: closing the gallery sometimes also fires the Sheet's own
  // dismiss shortly after, even after `galleryProjectId` has already gone
  // back to null. A short grace period after closing the gallery catches
  // that cascade regardless of exact event ordering.
  const gallerySuppressUntilRef = useRef(0);

  function closeGallery() {
    setGalleryProjectId(null);
    gallerySuppressUntilRef.current = Date.now() + 400;
  }

  useEffect(() => {
    if (!open || !department?.departmentPublicId) return;
    let cancelled = false;
    setDetail(null);
    setError(false);
    setSearch('');
    setOpenProjectId(null);
    setProjectDetailCache({});
    setGalleryProjectId(null);

    fetch(`/api/public/department/${department.departmentPublicId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (cancelled) return;
        setDetail(json.department as DepartmentDetail);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, department?.departmentPublicId]);

  const projects = useMemo(() => {
    const list = detail?.projects ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.projectCode ?? '').toLowerCase().includes(q),
    );
  }, [detail, search]);

  function ensureProjectDetail(p: ApiProject) {
    if (projectDetailCache[p.projectId]) return;
    setProjectDetailCache((c) => ({ ...c, [p.projectId]: 'loading' }));
    fetch(`/api/public/project/${p.projectPublicId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        const proj = json.project;
        setProjectDetailCache((c) => ({
          ...c,
          [p.projectId]: {
            indicators: proj.indicators as ApiIndicator[],
            images: proj.images as PublicProjectImage[],
            videos: proj.videos as PublicProjectVideo[],
            documents: proj.documents as PublicProjectDocument[],
          },
        }));
      })
      .catch(() => {
        setProjectDetailCache((c) => ({ ...c, [p.projectId]: 'error' }));
      });
  }

  function toggleProject(p: ApiProject) {
    const next = openProjectId === p.projectId ? null : p.projectId;
    setOpenProjectId(next);
    if (next !== null) ensureProjectDetail(p);
  }

  function openGallery(p: ApiProject) {
    ensureProjectDetail(p);
    setGalleryProjectId(p.projectId);
  }

  const galleryProject = projects.find((p) => p.projectId === galleryProjectId) ?? null;
  const galleryEntry = galleryProjectId !== null ? projectDetailCache[galleryProjectId] : undefined;

  function indicatorsFor(projectId: number): ApiIndicator[] | 'loading' | 'error' | undefined {
    const entry = projectDetailCache[projectId];
    if (entry === 'loading' || entry === 'error' || entry === undefined) return entry;
    return entry.indicators;
  }

  if (!department) return null;

  // Radix's outside-click dismiss logic for two independently-mounted
  // Dialog.Root instances (this Sheet + the gallery Dialog below) doesn't
  // reliably defer to whichever is "on top" — clicking inside the gallery
  // can register as an outside-click for the Sheet's own dismiss layer and
  // close both. Escape-key handling has an explicit topmost-layer guard and
  // works correctly; pointer-based dismiss doesn't, so guard it directly:
  // the drawer must never close while its own gallery is open.
  function handleSheetOpenChange(next: boolean) {
    if (!next && (galleryProjectId !== null || Date.now() < gallerySuppressUntilRef.current)) {
      return;
    }
    onOpenChange(next);
  }

  return (
    <>
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[620px]">
        {/* HEADER */}
        <div className="shrink-0 border-b bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <nav className="font-malayalam flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>വകുപ്പ്</span>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span>പദ്ധതികൾ</span>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span>ഘടകങ്ങൾ</span>
            </nav>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-hdp-bg hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h2 className="font-malayalam mt-2 text-xl font-bold text-foreground">
            {department.nameMal}
          </h2>
          {department.nameEn && department.nameEn !== department.nameMal && (
            <p className="text-xs text-muted-foreground">{department.nameEn}</p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <SummaryStat labelMal="പദ്ധതികൾ" value={detail?.stats.projects ?? department.projects} />
            <SummaryStat
              labelMal="പൂർത്തിയായവ"
              value={detail?.stats.completed ?? department.projectsCompleted}
              tone="success"
            />
            <SummaryStat labelMal="ഘടകങ്ങൾ" value={detail?.stats.indicators ?? department.indicators} />
          </div>
        </div>

        {/* SEARCH */}
        <div className="shrink-0 border-b bg-white px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="പദ്ധതി തിരയുക..."
              className="font-malayalam h-10 rounded-full pl-9"
            />
          </div>
        </div>

        {/* PROJECT LIST */}
        <div className="flex-1 overflow-y-auto bg-hdp-bg/30 px-5 py-4">
          {!detail && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-malayalam">പദ്ധതികൾ ലോഡുചെയ്യുന്നു…</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-hdp-danger">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-malayalam">വിവരങ്ങൾ ലഭ്യമായില്ല</span>
            </div>
          )}

          {detail && projects.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <span className="font-malayalam">പദ്ധതികളൊന്നും കണ്ടെത്തിയില്ല</span>
            </div>
          )}

          {detail && projects.length > 0 && (
            <ul className="space-y-3">
              {projects.map((p) => (
                <ProjectRow
                  key={p.projectId}
                  project={p}
                  isOpen={openProjectId === p.projectId}
                  onToggle={() => toggleProject(p)}
                  onOpenGallery={() => openGallery(p)}
                  indicators={indicatorsFor(p.projectId)}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>

      {/* IN-PLACE MEDIA GALLERY — overlays the drawer instead of navigating
          away, so browsing photos doesn't break the department -> project
          drill-down flow. Rendered as a SIBLING of <Sheet>, not a child —
          React portals still bubble events up the *component* tree even
          though their DOM lives elsewhere, so nesting this Dialog inside
          the Sheet caused closing the gallery to also close the drawer. */}
      <Dialog
        open={galleryProjectId !== null}
        onOpenChange={(o) => !o && closeGallery()}
      >
        <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <div className="shrink-0 border-b bg-white px-5 py-4">
            <p className="font-malayalam text-[10px] font-semibold uppercase tracking-wide text-hdp-green">
              മീഡിയ ഗാലറി
            </p>
            <h3
              className="font-malayalam mt-0.5 pr-8 text-base font-bold text-foreground"
              title={galleryProject?.name ?? ''}
            >
              {galleryProject?.name ?? ''}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto bg-hdp-bg/30 px-5 py-4">
            {galleryEntry === 'loading' && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-malayalam">മീഡിയ ലോഡുചെയ്യുന്നു…</span>
              </div>
            )}
            {galleryEntry === 'error' && (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-hdp-danger">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-malayalam">മീഡിയ ലഭ്യമായില്ല</span>
              </div>
            )}
            {galleryEntry && typeof galleryEntry === 'object' && (
              <ProjectGallery
                images={galleryEntry.images}
                videos={galleryEntry.videos}
                documents={galleryEntry.documents}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectRow({
  project: p,
  isOpen,
  onToggle,
  onOpenGallery,
  indicators,
}: {
  project: ApiProject;
  isOpen: boolean;
  onToggle: () => void;
  onOpenGallery: () => void;
  indicators: ApiIndicator[] | 'loading' | 'error' | undefined;
}) {
  const tone = STATUS_CHIP[p.status];
  const completedOn = p.status === 'completed' ? formatDate(p.completionDate) : null;
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-hdp-green/10 text-hdp-green">
          <ClipboardList className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`font-malayalam text-sm font-semibold text-foreground ${isOpen ? '' : 'line-clamp-2'}`}
            title={p.name}
          >
            {p.name}
          </p>
          {p.projectCode && (
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Project Code: <span className="font-mono">{p.projectCode}</span>
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold ${tone.chip}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              <span className="font-malayalam">{tone.labelMal}</span>
            </span>
            <span className="font-mono">{p.physicalPct}%</span>
            <span className="font-malayalam">
              ആകെ ഘടകങ്ങൾ <span className="font-mono font-semibold">{p.indicatorsTotal}</span>
            </span>
            <span className="font-malayalam text-hdp-success">
              പൂർത്തിയായവ <span className="font-mono font-semibold">{p.indicatorsCompleted}</span>
            </span>
            {completedOn && (
              <span className="inline-flex items-center gap-1 text-hdp-success">
                <CalendarCheck2 className="h-3 w-3" />
                <span className="font-mono">{completedOn}</span>
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {(!!p.imageCount || !!p.videoCount || !!p.documentCount) && (
        <div
          className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          {!!p.imageCount && (
            <MediaChipButton
              onClick={onOpenGallery}
              icon={Images}
              count={p.imageCount}
              labelMal="ചിത്രങ്ങൾ"
            />
          )}
          {!!p.videoCount && (
            <MediaChipButton
              onClick={onOpenGallery}
              icon={Video}
              count={p.videoCount}
              labelMal="വീഡിയോ"
            />
          )}
          {!!p.documentCount && (
            <MediaChipButton
              onClick={onOpenGallery}
              icon={FileText}
              count={p.documentCount}
              labelMal="രേഖകൾ"
            />
          )}
        </div>
      )}

      {isOpen && (
        <div className="border-t border-dashed border-border bg-hdp-bg/40 px-4 py-3">
          {indicators === 'loading' && (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="font-malayalam">ഘടകങ്ങൾ ലോഡുചെയ്യുന്നു…</span>
            </div>
          )}
          {indicators === 'error' && (
            <p className="py-3 text-xs text-hdp-danger">
              <span className="font-malayalam">ഘടകങ്ങൾ ലഭ്യമായില്ല</span>
            </p>
          )}
          {Array.isArray(indicators) && indicators.length === 0 && p.indicatorsTotal === 0 && (
            <p className="py-3 text-xs text-muted-foreground">
              <span className="font-malayalam">ഘടകങ്ങൾ ചേർത്തിട്ടില്ല</span>
            </p>
          )}
          {/* The indicator list below only ever shows VERIFIED indicators
              (the API filters unverified ones out) — but indicatorsTotal
              counts all submitted indicators regardless of verification.
              When those two disagree, say so explicitly instead of the
              misleading "none added" message. */}
          {Array.isArray(indicators) && indicators.length === 0 && p.indicatorsTotal > 0 && (
            <p className="py-3 text-xs text-muted-foreground">
              <span className="font-malayalam">
                {p.indicatorsTotal} ഘടകങ്ങൾ സമർപ്പിച്ചിട്ടുണ്ട്, എന്നാൽ സ്ഥിരീകരണം ബാക്കിയാണ്
              </span>
            </p>
          )}
          {Array.isArray(indicators) && indicators.length > 0 && (
            <ul className="space-y-2">
              {indicators.map((ind) => {
                const completedOn = ind.physicalPct >= 100 ? formatDate(ind.completedDate) : null;
                return (
                  <li key={ind.indicatorId} className="rounded-xl bg-white p-2.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="font-malayalam min-w-0 flex-1 text-xs font-medium text-foreground"
                        title={ind.name}
                      >
                        {ind.name}
                      </p>
                      <span className="flex shrink-0 items-center gap-1 font-mono text-xs font-semibold text-foreground">
                        <CheckCircle2 className="h-3 w-3 text-hdp-success" />
                        {ind.physicalPct}%
                      </span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span>
                        <span className="font-mono">
                          {ind.physicalAchievement}/{ind.physicalTarget}
                        </span>{' '}
                        {ind.unit}
                      </span>
                      {completedOn && (
                        <span className="inline-flex items-center gap-1 text-hdp-success">
                          <CalendarCheck2 className="h-3 w-3" />
                          <span className="font-mono">{completedOn}</span>
                        </span>
                      )}
                    </p>
                    <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-hdp-success transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, ind.physicalPct))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function MediaChipButton({
  onClick,
  icon: Icon,
  count,
  labelMal,
}: {
  onClick: () => void;
  icon: typeof Images;
  count: number;
  labelMal: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full bg-hdp-bg px-2 py-0.5 text-[10px] text-hdp-green ring-1 ring-border transition-colors hover:bg-hdp-green/10 hover:ring-hdp-green/30"
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span className="font-mono font-semibold">{count}</span>
      <span className="font-malayalam">{labelMal}</span>
    </button>
  );
}

function SummaryStat({
  labelMal,
  value,
  tone = 'default',
}: {
  labelMal: string;
  value: number | string;
  tone?: 'default' | 'success';
}) {
  return (
    <div className="rounded-xl border border-border bg-hdp-bg/40 px-2 py-2 text-center">
      <p
        className={`font-mono text-base font-extrabold leading-none ${tone === 'success' ? 'text-hdp-success' : 'text-foreground'}`}
      >
        {value}
      </p>
      <p className="font-malayalam mt-1 text-[9px] leading-tight text-muted-foreground">{labelMal}</p>
    </div>
  );
}
