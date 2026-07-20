import { Building2, Briefcase, Target, Clock, TrendingUp, IndianRupee, Images, Camera, Video, FileText } from 'lucide-react';

type KPISummaryCardsProps = {
  departmentCount: number;
  projectCount: number;
  indicatorCount: number;
  laggingCount: number;
  avgPhysical: number;
  avgFinancial: number | null;
  images: number;
  videos: number;
  documents: number;
};

export function KPISummaryCards({
  departmentCount,
  projectCount,
  indicatorCount,
  laggingCount,
  avgPhysical,
  avgFinancial,
  images,
  videos,
  documents,
}: KPISummaryCardsProps) {
  const cards = [
    {
      label: 'Total Departments',
      value: departmentCount,
      icon: Building2,
      iconBg: 'bg-kerala-blue/10',
      iconColor: 'text-kerala-blue',
    },
    {
      label: 'Total Projects',
      value: projectCount,
      icon: Briefcase,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Total Indicators',
      value: indicatorCount,
      icon: Target,
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
    },
    {
      label: 'Lagging Rows',
      value: laggingCount,
      icon: Clock,
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      valueColor: laggingCount > 0 ? 'text-rose-600' : undefined,
    },
    {
      label: 'Avg Physical Progress',
      value: `${avgPhysical}%`,
      icon: TrendingUp,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Avg Financial Progress',
      value: avgFinancial === null ? '—' : `${avgFinancial}%`,
      icon: IndianRupee,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Media Uploaded',
      value: images + videos + documents,
      icon: Images,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      breakdown: [
        { icon: Camera, count: images },
        { icon: Video, count: videos },
        { icon: FileText, count: documents },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="flex items-start gap-3 rounded-lg border bg-white p-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
              <Icon className={`h-4.5 w-4.5 ${card.iconColor}`} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium leading-tight text-muted-foreground">{card.label}</div>
              <div className={`mt-1 text-xl font-bold leading-none ${card.valueColor ?? 'text-foreground'}`}>
                {card.value}
              </div>
              {card.breakdown && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  {card.breakdown.map((item, index) => {
                    const BreakdownIcon = item.icon;
                    return (
                      <span key={index} className="flex items-center gap-0.5">
                        <BreakdownIcon className="h-3 w-3" />
                        {item.count}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
