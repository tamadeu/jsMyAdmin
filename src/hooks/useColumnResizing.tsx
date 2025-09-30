import { useState, useCallback, useRef, useEffect } from 'react';

interface ColumnWidth {
  [columnName: string]: number;
}

interface UseColumnResizingProps {
  columns: Array<{ name: string }>;
  defaultWidth?: number;
  minWidth?: number;
}

export const useColumnResizing = ({ 
  columns, 
  defaultWidth = 150, 
  minWidth = 100 
}: UseColumnResizingProps) => {
  const [columnWidths, setColumnWidths] = useState<ColumnWidth>({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  // Initialize column widths when columns change
  useEffect(() => {
    if (columns.length > 0) {
      const initialWidths: ColumnWidth = {};
      columns.forEach(column => {
        if (!columnWidths[column.name]) {
          initialWidths[column.name] = defaultWidth;
        }
      });
      if (Object.keys(initialWidths).length > 0) {
        setColumnWidths(prev => ({ ...prev, ...initialWidths }));
      }
    }
  }, [columns, defaultWidth, columnWidths]);

  const handleMouseDown = useCallback((columnName: string, event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
    setResizingColumn(columnName);
    startXRef.current = event.clientX;
    startWidthRef.current = columnWidths[columnName] || defaultWidth;
    
    // Add cursor and selection styles to body during resize
    document.body.classList.add('col-resize', 'no-select');
  }, [columnWidths, defaultWidth]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isResizing || !resizingColumn) return;

    const diff = event.clientX - startXRef.current;
    const newWidth = Math.max(minWidth, startWidthRef.current + diff);
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }));
  }, [isResizing, resizingColumn, minWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizingColumn(null);
    
    // Remove cursor and selection styles from body
    document.body.classList.remove('col-resize', 'no-select');
  }, []);

  // Add global mouse events for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const getColumnWidth = useCallback((columnName: string) => {
    return columnWidths[columnName] || defaultWidth;
  }, [columnWidths, defaultWidth]);

  const resetColumnWidth = useCallback((columnName: string) => {
    setColumnWidths(prev => ({
      ...prev,
      [columnName]: defaultWidth
    }));
  }, [defaultWidth]);

  const resetAllWidths = useCallback(() => {
    const resetWidths: ColumnWidth = {};
    columns.forEach(column => {
      resetWidths[column.name] = defaultWidth;
    });
    setColumnWidths(resetWidths);
  }, [columns, defaultWidth]);

  return {
    columnWidths,
    isResizing,
    resizingColumn,
    handleMouseDown,
    getColumnWidth,
    resetColumnWidth,
    resetAllWidths
  };
};