import type { ReactNode } from "react";

export function PageHeader({
  context,
  title,
  description,
  actions,
}: {
  context?: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-inner">
        <div className="page-header-copy">
          <h1>{title}</h1>
          <p className="page-description">{description}</p>
          {context ? <p className="page-context">{context}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}
