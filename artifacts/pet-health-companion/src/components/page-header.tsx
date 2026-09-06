import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-serif font-medium text-foreground tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-3 max-w-2xl text-lg leading-relaxed">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
