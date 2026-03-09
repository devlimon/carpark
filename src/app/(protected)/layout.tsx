import React from 'react';
import { Sidebar } from '@/components/ui/Sidebar';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 md:ml-56 min-h-screen">
        <div className="px-4 py-6 md:px-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
