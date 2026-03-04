'use client';

import { type ReactNode } from 'react';
import { Nav } from './nav';
import { Sidebar } from './sidebar';

export function DashboardLayout({
  children,
  role = 'talent',
}: {
  children: ReactNode;
  role?: 'talent' | 'admin';
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <div className="flex flex-1">
        <Sidebar role={role} />
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 sm:pb-20 lg:p-8 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
