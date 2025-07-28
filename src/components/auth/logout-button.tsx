
'use client';

import { logoutAction } from '@/lib/actions';
import { Button } from '../ui/button';
import { LogOut } from 'lucide-react';
import { useTransition } from 'react';

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    // Clear session from localStorage
    localStorage.removeItem('session');
    localStorage.removeItem('hideHeader');
    // Call server logout action
    startTransition(() => logoutAction());
  };

  return (
    <Button
      variant="ghost"
      className="w-full justify-start text-sm group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
      disabled={isPending}
      onClick={handleLogout}
    >
      <LogOut className="mr-2 h-4 w-4 group-data-[collapsible=icon]:mr-0" />
      <span className="group-data-[collapsible=icon]:hidden">
        {isPending ? 'Logging out...' : 'Logout'}
      </span>
    </Button>
  );
}
