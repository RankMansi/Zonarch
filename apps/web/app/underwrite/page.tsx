import { Suspense } from 'react';
import UnderwriteWorkbench from '@/components/underwrite/UnderwriteWorkbench';

function UnderwriteLoading() {
  return (
    <div className="terminal-bento-page underwrite-page min-h-dvh flex items-center justify-center bg-[#e8e0d4]">
      <p className="text-sm text-[#6b4423]">Loading workbench…</p>
    </div>
  );
}

export default function UnderwritePage() {
  return (
    <Suspense fallback={<UnderwriteLoading />}>
      <UnderwriteWorkbench />
    </Suspense>
  );
}
