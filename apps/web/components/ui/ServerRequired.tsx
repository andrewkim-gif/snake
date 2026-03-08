'use client';

import { isServerAvailable } from '@/lib/api-client';

export function ServerRequired({ children }: { children: React.ReactNode }) {
  if (!isServerAvailable()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-500">
        <div className="text-4xl mb-4">⚡</div>
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">Server Connection Required</h3>
        <p className="text-sm text-center max-w-md">
          This feature requires an active server connection.
          Start the server with <code className="text-amber-400">./game.sh</code> to see live data.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
