import { AppTab } from "@/context/TabContext";

export function getTabPath(tab: AppTab): string {
  switch (tab.type) {
    case 'dashboard':
      return '/';
    case 'sql-editor':
      return '/sql';
    case 'config':
      return '/configuration';
    case 'users':
      return '/users';
    case 'database-tables-list':
      if (tab.params?.database) {
        if (tab.filterType === 'tables') return `/${tab.params.database}/tables`;
        if (tab.filterType === 'views') return `/${tab.params.database}/views`;
        return `/${tab.params.database}`; // Default for all tables/views
      }
      return '/'; // Fallback
    case 'table':
      if (tab.params?.database && tab.params?.table) {
        return `/${tab.params.database}/${tab.params.table}`;
      }
      return '/'; // Fallback
    case 'table-structure':
      if (tab.params?.database && tab.params?.table) {
        return `/${tab.params.database}/${tab.params.table}/structure`;
      }
      return '/'; // Fallback
    case 'query-result':
      // Query results don't have a direct URL path, stay on current path or dashboard
      return '/'; 
    default:
      return '/';
  }
}