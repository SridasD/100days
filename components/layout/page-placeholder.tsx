import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  title: string;
  /** Route as it appears in the blueprint, e.g. "/officer/projects" */
  route: string;
  /** Section of HDP_Platform_Blueprint_v2.md this page implements */
  section: string;
  /** Short description of what this page is supposed to do */
  description: string;
  children?: React.ReactNode;
}

export function PagePlaceholder({ title, route, section, description, children }: Props) {
  return (
    <main className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex items-baseline justify-between">
            <CardTitle className="text-kerala-blue">{title}</CardTitle>
            <code className="font-mono text-xs text-muted-foreground">{route}</code>
          </div>
          <CardDescription>
            Blueprint reference: <span className="font-medium">{section}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
          <p className="mt-4 text-xs text-warning-amber">
            🚧 Placeholder — implement against HDP_Platform_Blueprint_v2.md
          </p>
          {children}
        </CardContent>
      </Card>
    </main>
  );
}
