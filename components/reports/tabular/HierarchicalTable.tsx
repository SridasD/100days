'use client';

import { Fragment } from 'react';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import type { DepartmentGroup } from './types';
import { DepartmentRow } from './DepartmentRow';
import { ProjectRow } from './ProjectRow';
import { IndicatorRow } from './IndicatorRow';

type HierarchicalTableProps = {
  departments: DepartmentGroup[];
  startIndex: number;
  expandedDepts: Set<string>;
  expandedProjects: Set<string>;
  onToggleDept: (key: string) => void;
  onToggleProject: (key: string) => void;
};

export function HierarchicalTable({
  departments,
  startIndex,
  expandedDepts,
  expandedProjects,
  onToggleDept,
  onToggleProject,
}: HierarchicalTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[1650px] caption-bottom text-sm">
        <thead className="sticky top-0 z-20 bg-kerala-blue text-white">
          <tr>
            <th rowSpan={2} className="sticky left-0 z-30 h-11 bg-kerala-blue px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide">
              Hierarchy
            </th>
            <th colSpan={2} className="border-b border-white/20 px-4 py-1 text-center text-xs font-semibold uppercase tracking-wide">
              Projects
            </th>
            <th colSpan={2} className="border-b border-white/20 px-4 py-1 text-center text-xs font-semibold uppercase tracking-wide">
              Indicators
            </th>
            <th rowSpan={2} className="px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide">
              Implementing Agency / HOD
            </th>
            <th rowSpan={2} className="px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide">
              Physical Progress (%)
            </th>
            <th rowSpan={2} className="px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide">
              Financial Progress (%)
            </th>
            <th rowSpan={2} className="px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide">
              Verification Status
            </th>
            <th rowSpan={2} className="px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide">
              Status
            </th>
            <th rowSpan={2} className="px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide">
              Last Progress Update
            </th>
            <th colSpan={3} className="border-b border-white/20 px-4 py-1 text-center text-xs font-semibold uppercase tracking-wide">
              Media Uploaded
            </th>
          </tr>
          <tr>
            <th className="h-9 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wide">Total</th>
            <th className="h-9 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wide">Completed</th>
            <th className="h-9 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wide">Total</th>
            <th className="h-9 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wide">Completed</th>
            <th className="h-9 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wide">Images</th>
            <th className="h-9 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wide">Videos</th>
            <th className="h-9 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wide">Documents</th>
          </tr>
        </thead>
        <TableBody>
          {departments.map((department, deptIndex) => {
            const deptNumber = startIndex + deptIndex + 1;
            const deptExpanded = expandedDepts.has(department.name);

            return (
              <Fragment key={department.name}>
                <DepartmentRow
                  department={department}
                  number={deptNumber}
                  expanded={deptExpanded}
                  onToggle={() => onToggleDept(department.name)}
                />
                {deptExpanded &&
                  department.projects.map((project, projIndex) => {
                    const projectKey = `${department.name}::${project.key}`;
                    const projectNumber = `${deptNumber}.${projIndex + 1}`;
                    const projectExpanded = expandedProjects.has(projectKey);

                    return (
                      <Fragment key={projectKey}>
                        <ProjectRow
                          project={project}
                          number={projectNumber}
                          expanded={projectExpanded}
                          onToggle={() => onToggleProject(projectKey)}
                        />
                        {projectExpanded &&
                          project.indicators.map((indicator, indIndex) => (
                            <IndicatorRow
                              key={`${projectKey}-${indIndex}`}
                              indicator={indicator}
                              number={`${projectNumber}.${indIndex + 1}`}
                            />
                          ))}
                      </Fragment>
                    );
                  })}
              </Fragment>
            );
          })}
          {departments.length === 0 && (
            <TableRow>
              <TableCell colSpan={14} className="py-10 text-center text-sm text-muted-foreground">
                No departments on this page.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </table>
    </div>
  );
}
