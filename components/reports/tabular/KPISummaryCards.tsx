import { Building2, Briefcase, Target, CheckCircle2, ListChecks, Images, Camera, Video, FileText, TriangleAlert } from 'lucide-react';

type KPISummaryCardsProps = {
  departmentCount: number;
  projectCount: number;
  projectsWithNoIndicators: number;
  indicatorCount: number;
  completedProjectCount: number;
  completedIndicatorCount: number;
  images: number;
  videos: number;
  documents: number;
};

export function KPISummaryCards({
  departmentCount,
  projectCount,
  projectsWithNoIndicators,
  indicatorCount,
  completedProjectCount,
  completedIndicatorCount,
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
      label: 'Projects Without Indicators',
      value: projectsWithNoIndicators,
      icon: TriangleAlert,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-700',
    },
    {
      label: 'Projects Completed',
      value: completedProjectCount,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Indicators Completed',
      value: completedIndicatorCount,
      icon: ListChecks,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="flex items-start gap-3 rounded-lg border bg-white p-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
              <Icon className={`h-4.5 w-4.5 ${card.iconColor}`} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium leading-tight text-muted-foreground">{card.label}</div>
              <div className="mt-1 text-xl font-bold leading-none text-foreground">
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
