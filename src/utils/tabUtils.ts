import { AppTab } from "@/context/TabContext";

export function getTabPath(tab: AppTab): string {
  const baseUrl = '/';
  const params = new URLSearchParams();

  switch (tab.type) {
    case 'dashboard':
      return baseUrl; // Just the root URL
    case 'sql-editor':
      params.set('page', 'sql');
      break;
    case 'config':
      params.set('page', 'config');
      break;
    case 'users':
      params.set('page', 'users');
      break;
    case 'database-tables-list':
      if (tab.params?.database) {
        params.set('db', tab.params.database);
        if (tab.filterType === 'tables') params.set('filter', 'tables');
        if (tab.filterType === 'views') params.set('filter', 'views');
      }
      break;
    case 'table':
      if (tab.params?.database && tab.params?.table) {
        params.set('db', tab.params.database);
        params.set('table', tab.params.table);
      }
      break;
    case 'table-structure':
      if (tab.params?.database && tab.params?.table) {
        params.set('db', tab.params.database);
        params.set('table', tab.params.table);
        params.set('view', 'structure');
      }
      break;
    case 'query-result':
      // Query results don't have direct URL representation
      return baseUrl;
    default:
      return baseUrl;
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}