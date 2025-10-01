"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import * as monaco from 'monaco-editor';

interface TableInfo {
  name: string;
  columns?: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: string;
  }>;
}

interface SqlCodeEditorProps {
  value: string;
  onValueChange: (code: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>) => void;
  onExecute?: (query: string) => void; // Callback específico para execução
  placeholder?: string;
  readOnly?: boolean;
  height?: string;
  tables?: string[]; // Para autocompletar tabelas (formato simples)
  databases?: string[]; // Para autocompletar databases
  tablesWithColumns?: TableInfo[]; // Para autocompletar com informações de colunas
}

const SqlCodeEditor = ({ 
  value, 
  onValueChange, 
  onKeyDown, 
  onExecute,
  placeholder, 
  readOnly, 
  height = '30vh',
  tables = [],
  databases = [],
  tablesWithColumns = []
}: SqlCodeEditorProps) => {
  const { theme } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Configurar o Monaco Editor quando ele for montado
  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    // Definir tema personalizado para modo escuro
    monacoInstance.editor.defineTheme('jsMyAdmin-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword.sql', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'string.sql', foreground: 'ce9178' },
        { token: 'comment.sql', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'number.sql', foreground: 'b5cea8' },
        { token: 'operator.sql', foreground: 'd4d4d4' },
        { token: 'identifier.sql', foreground: '9cdcfe' }
      ],
      colors: {
        'editor.background': '#0f172a', // Tailwind slate-900
        'editor.foreground': '#f8fafc', // Tailwind slate-50
        'editorLineNumber.foreground': '#64748b', // Tailwind slate-500
        'editorLineNumber.activeForeground': '#cbd5e1', // Tailwind slate-300
        'editor.selectionBackground': '#334155', // Tailwind slate-700
        'editor.lineHighlightBackground': '#1e293b', // Tailwind slate-800
        'editorCursor.foreground': '#38bdf8', // Tailwind sky-400
        'editor.findMatchBackground': '#fbbf24', // Tailwind amber-400
        'editor.findMatchHighlightBackground': '#f59e0b' // Tailwind amber-500
      }
    });

    // Definir tema personalizado para modo claro
    monacoInstance.editor.defineTheme('jsMyAdmin-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword.sql', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'string.sql', foreground: 'a31515' },
        { token: 'comment.sql', foreground: '008000', fontStyle: 'italic' },
        { token: 'number.sql', foreground: '098658' },
        { token: 'operator.sql', foreground: '000000' },
        { token: 'identifier.sql', foreground: '001080' }
      ],
      colors: {
        'editor.background': '#ffffff', // Branco
        'editor.foreground': '#000000', // Preto
        'editorLineNumber.foreground': '#64748b', // Tailwind slate-500
        'editorLineNumber.activeForeground': '#334155', // Tailwind slate-700
        'editor.selectionBackground': '#e2e8f0', // Tailwind slate-200
        'editor.lineHighlightBackground': '#f8fafc', // Tailwind slate-50
        'editorCursor.foreground': '#0ea5e9', // Tailwind sky-500
        'editor.findMatchBackground': '#fbbf24', // Tailwind amber-400
        'editor.findMatchHighlightBackground': '#f59e0b' // Tailwind amber-500
      }
    });

    // Configurar keybindings personalizados
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter, () => {
      const currentValue = editor.getValue();
      
      // Usar callback específico de execução se disponível
      if (onExecute) {
        onExecute(currentValue);
      } else {
        // Fallback para o método anterior
        onValueChange(currentValue);
        
        if (onKeyDown) {
          const mockEvent = {
            ctrlKey: true,
            key: 'Enter',
            preventDefault: () => {}
          } as React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>;
          onKeyDown(mockEvent);
        }
      }
    });

    // Adicionar comando para formatar SQL (Ctrl+Shift+F)
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF, () => {
      const model = editor.getModel();
      if (model) {
        try {
          // Usar sql-formatter se estiver disponível
          import('sql-formatter').then(({ format }) => {
            const formatted = format(model.getValue(), {
              language: 'mysql',
              tabWidth: 2,
              linesBetweenQueries: 2
            });
            model.setValue(formatted);
          }).catch(() => {
            // Fallback para formatação básica
            const value = model.getValue();
            const formatted = value
              .replace(/\s+/g, ' ')
              .replace(/,\s*/g, ',\n  ')
              .replace(/\bFROM\b/gi, '\nFROM')
              .replace(/\bWHERE\b/gi, '\nWHERE')
              .replace(/\bJOIN\b/gi, '\nJOIN')
              .replace(/\bORDER BY\b/gi, '\nORDER BY')
              .replace(/\bGROUP BY\b/gi, '\nGROUP BY');
            model.setValue(formatted);
          });
        } catch (error) {
          console.error('Error formatting SQL:', error);
        }
      }
    });

    // Adicionar comando para converter para maiúsculas (Ctrl+U)
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyU, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (selection && model) {
        const selectedText = model.getValueInRange(selection);
        if (selectedText) {
          // Converter apenas palavras-chave SQL para maiúsculas
          const sqlKeywords = ['select', 'from', 'where', 'join', 'inner', 'left', 'right', 'full', 'outer', 'on', 'and', 'or', 'not', 'in', 'exists', 'between', 'like', 'is', 'null', 'order', 'by', 'group', 'having', 'limit', 'offset', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'alter', 'drop', 'index', 'primary', 'key', 'foreign', 'references', 'unique', 'check', 'default', 'auto_increment', 'varchar', 'int', 'bigint', 'decimal', 'date', 'datetime', 'timestamp', 'text', 'boolean'];
          
          let convertedText = selectedText;
          sqlKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            convertedText = convertedText.replace(regex, keyword.toUpperCase());
          });
          
          editor.executeEdits('convert-to-uppercase', [{
            range: selection,
            text: convertedText
          }]);
        }
      }
    });

    // Adicionar comando para comentar/descomentar (Ctrl+/)
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Slash, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (selection && model) {
        const startLine = selection.startLineNumber;
        const endLine = selection.endLineNumber;
        
        for (let line = startLine; line <= endLine; line++) {
          const lineContent = model.getLineContent(line);
          const trimmed = lineContent.trim();
          
          if (trimmed.startsWith('-- ')) {
            // Remover comentário
            const newContent = lineContent.replace('-- ', '');
            model.pushEditOperations([], [{
              range: new monacoInstance.Range(line, 1, line, lineContent.length + 1),
              text: newContent
            }], () => null);
          } else {
            // Adicionar comentário
            const indent = lineContent.match(/^\s*/)?.[0] || '';
            const newContent = indent + '-- ' + lineContent.trim();
            model.pushEditOperations([], [{
              range: new monacoInstance.Range(line, 1, line, lineContent.length + 1),
              text: newContent
            }], () => null);
          }
        }
      }
    });

    // Configurar validação e linting SQL
    monacoInstance.languages.registerDocumentFormattingEditProvider('sql', {
      provideDocumentFormattingEdits: (model, options, token) => {
        // Aqui você pode integrar com sql-formatter se desejar
        return [];
      }
    });

    // Registrar provider de autocomplete personalizado
    const completionProvider = monacoInstance.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const suggestions = [];

        // Palavras-chave SQL
        const sqlKeywords = [
          'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
          'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'DATABASE',
          'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'ORDER BY', 'GROUP BY',
          'HAVING', 'DISTINCT', 'UNION', 'EXISTS', 'IN', 'NOT', 'AND', 'OR', 'NULL',
          'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'LIMIT', 'OFFSET', 'AS', 'ON', 'USING'
        ];

        // Funções SQL comuns
        const sqlFunctions = [
          'COUNT()', 'SUM()', 'AVG()', 'MIN()', 'MAX()', 'CONCAT()', 'SUBSTRING()',
          'LENGTH()', 'UPPER()', 'LOWER()', 'TRIM()', 'LTRIM()', 'RTRIM()', 'REPLACE()',
          'NOW()', 'CURDATE()', 'CURTIME()', 'DATE()', 'TIME()', 'YEAR()', 'MONTH()',
          'DAY()', 'HOUR()', 'MINUTE()', 'SECOND()', 'DATE_FORMAT()', 'STR_TO_DATE()',
          'DATEDIFF()', 'DATE_ADD()', 'DATE_SUB()', 'IF()', 'IFNULL()', 'NULLIF()',
          'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'COALESCE()'
        ];

        // Criar um Set para evitar duplicatas usando label como chave única
        const addedSuggestions = new Set<string>();

        // Função helper para adicionar sugestão evitando duplicatas
        const addSuggestion = (suggestion: any) => {
          if (!addedSuggestions.has(suggestion.label)) {
            addedSuggestions.add(suggestion.label);
            suggestions.push(suggestion);
          }
        };

        // 1. Adicionar keywords SQL
        sqlKeywords.forEach(keyword => {
          addSuggestion({
            label: keyword,
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            documentation: `SQL keyword: ${keyword}`,
            sortText: `1${keyword}`
          });
        });

        // 2. Adicionar funções SQL
        sqlFunctions.forEach(func => {
          addSuggestion({
            label: func,
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: func,
            documentation: `SQL function: ${func}`,
            sortText: `2${func}`
          });
        });

        // 3. Processar todas as tabelas de forma unificada
        // Primeiro coletar todas as tabelas em um Map para evitar duplicatas
        const allTablesMap = new Map<string, any>();

        // Adicionar tabelas com colunas (prioridade máxima)
        tablesWithColumns.forEach(table => {
          allTablesMap.set(table.name, {
            name: table.name,
            hasColumns: true,
            columns: table.columns || [],
            documentation: `Table: ${table.name}${table.columns ? ` (${table.columns.length} columns)` : ''}`
          });
        });

        // Adicionar tabelas simples (apenas se não existirem ainda)
        tables.forEach(table => {
          const tableName = table.includes('.') ? table.split('.').pop() || table : table;
          const fullTableName = table;
          
          // Se é uma tabela com prefixo completo (database.table)
          if (table.includes('.')) {
            if (!allTablesMap.has(fullTableName)) {
              allTablesMap.set(fullTableName, {
                name: fullTableName,
                hasColumns: false,
                columns: [],
                documentation: `Table: ${fullTableName}`
              });
            }
          }
          
          // Tabela sem prefixo
          if (!allTablesMap.has(tableName)) {
            allTablesMap.set(tableName, {
              name: tableName,
              hasColumns: false,
              columns: [],
              documentation: `Table: ${tableName}`
            });
          }
        });

        // 4. Adicionar as tabelas do Map (sem duplicatas)
        Array.from(allTablesMap.values()).forEach(table => {
          addSuggestion({
            label: table.name,
            kind: monacoInstance.languages.CompletionItemKind.Class,
            insertText: table.name,
            documentation: table.documentation,
            sortText: `3${table.name}`
          });

          // Adicionar colunas se disponíveis
          if (table.hasColumns && table.columns) {
            table.columns.forEach(column => {
              const columnDetail = `${column.name}: ${column.type}${column.nullable ? ' (nullable)' : ' (not null)'}${column.default ? ` default: ${column.default}` : ''}`;
              
              // Coluna simples
              addSuggestion({
                label: column.name,
                kind: monacoInstance.languages.CompletionItemKind.Field,
                insertText: column.name,
                documentation: `Column from ${table.name}: ${columnDetail}`,
                sortText: `4${column.name}`,
                detail: `${table.name}.${column.name}`
              });

              // Coluna com prefixo
              addSuggestion({
                label: `${table.name}.${column.name}`,
                kind: monacoInstance.languages.CompletionItemKind.Field,
                insertText: `${table.name}.${column.name}`,
                documentation: columnDetail,
                sortText: `4${table.name}.${column.name}`,
                filterText: `${table.name} ${column.name}`
              });
            });
          }
        });

        // 5. Adicionar databases
        databases.forEach(db => {
          addSuggestion({
            label: db,
            kind: monacoInstance.languages.CompletionItemKind.Module,
            insertText: db,
            documentation: `Database: ${db}`,
            sortText: `5${db}`
          });
        });

        return { suggestions };
      }
    });

    // Configurar validação de sintaxe SQL
    const validateSql = (code: string) => {
      const markers: monaco.editor.IMarkerData[] = [];
      const lines = code.split('\n');
      
      lines.forEach((line, lineIndex) => {
        const trimmedLine = line.trim();
        
        // Verificar pontos e vírgulas no final de declarações
        if (trimmedLine.length > 0 && 
            !trimmedLine.endsWith(';') && 
            !trimmedLine.endsWith(',') && 
            !trimmedLine.toLowerCase().startsWith('--') &&
            (trimmedLine.toLowerCase().includes('select') ||
             trimmedLine.toLowerCase().includes('insert') ||
             trimmedLine.toLowerCase().includes('update') ||
             trimmedLine.toLowerCase().includes('delete') ||
             trimmedLine.toLowerCase().includes('create') ||
             trimmedLine.toLowerCase().includes('drop') ||
             trimmedLine.toLowerCase().includes('alter'))) {
          markers.push({
            severity: monacoInstance.MarkerSeverity.Warning,
            startLineNumber: lineIndex + 1,
            startColumn: line.length,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            message: 'Consider adding semicolon at the end of the statement'
          });
        }

        // Verificar palavras-chave em maiúscula (style guide)
        const sqlKeywords = ['select', 'from', 'where', 'join', 'inner', 'left', 'right', 'on', 'and', 'or', 'order', 'by', 'group', 'having', 'limit', 'offset'];
        sqlKeywords.forEach(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
          let match;
          while ((match = regex.exec(line)) !== null) {
            if (match[0] !== match[0].toUpperCase()) {
              markers.push({
                severity: monacoInstance.MarkerSeverity.Info,
                startLineNumber: lineIndex + 1,
                startColumn: match.index + 1,
                endLineNumber: lineIndex + 1,
                endColumn: match.index + match[0].length + 1,
                message: `Consider using uppercase for SQL keyword: ${keyword.toUpperCase()}`
              });
            }
          }
        });

        // Verificar uso de SELECT * (warning)
        if (line.toLowerCase().includes('select *')) {
          const selectStarIndex = line.toLowerCase().indexOf('select *');
          markers.push({
            severity: monacoInstance.MarkerSeverity.Warning,
            startLineNumber: lineIndex + 1,
            startColumn: selectStarIndex + 8,
            endLineNumber: lineIndex + 1,
            endColumn: selectStarIndex + 9,
            message: 'Consider specifying column names instead of using SELECT *'
          });
        }

        // Verificar parênteses balanceados
        let openParens = 0;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '(') openParens++;
          if (line[i] === ')') openParens--;
          if (openParens < 0) {
            markers.push({
              severity: monacoInstance.MarkerSeverity.Error,
              startLineNumber: lineIndex + 1,
              startColumn: i + 1,
              endLineNumber: lineIndex + 1,
              endColumn: i + 2,
              message: 'Unexpected closing parenthesis'
            });
            break;
          }
        }
      });

      // Verificar se há parênteses não fechados no código inteiro
      const allText = code;
      let totalOpenParens = 0;
      for (const char of allText) {
        if (char === '(') totalOpenParens++;
        if (char === ')') totalOpenParens--;
      }
      
      if (totalOpenParens > 0) {
        markers.push({
          severity: monacoInstance.MarkerSeverity.Error,
          startLineNumber: lines.length,
          startColumn: lines[lines.length - 1]?.length || 1,
          endLineNumber: lines.length,
          endColumn: (lines[lines.length - 1]?.length || 1) + 1,
          message: `${totalOpenParens} unclosed parenthesis${totalOpenParens > 1 ? 'es' : ''}`
        });
      }

      return markers;
    };

    // Aplicar validação quando o conteúdo mudar
    const model = editor.getModel();
    if (model) {
      const validateModel = () => {
        const markers = validateSql(model.getValue());
        monacoInstance.editor.setModelMarkers(model, 'sql-validator', markers);
      };
      
      // Validar inicialmente
      validateModel();
      
      // Validar a cada mudança (debounced)
      const disposable = model.onDidChangeContent(() => {
        setTimeout(validateModel, 500);
      });
      
      return () => disposable.dispose();
    }

    // Cleanup quando o componente for desmontado
    return () => {
      completionProvider.dispose();
    };
  }, [onKeyDown, tables, databases, tablesWithColumns]);

  // Determinar o tema baseado no tema atual
  const monacoTheme = theme === 'dark' ? 'jsMyAdmin-dark' : 'jsMyAdmin-light';

  return (
    <div className="border rounded-lg overflow-hidden">
      <Editor
        height={height}
        language="sql"
        theme={monacoTheme}
        value={value}
        onChange={(newValue) => onValueChange(newValue || '')}
        onMount={handleEditorDidMount}
        options={{
          // Funcionalidades básicas
          readOnly: readOnly || false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          
          // Numeração de linhas
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          
          // Indentação e formatação
          tabSize: 2,
          insertSpaces: true,
          autoIndent: 'advanced',
          formatOnPaste: true,
          formatOnType: true,
          
          // Autocompletar
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false
          },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'on',
          
          // Visual
          fontSize: 14,
          fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
          fontLigatures: true,
          
          // Comportamento do cursor
          cursorBlinking: 'blink',
          cursorSmoothCaretAnimation: 'on',
          
          // Seleção e busca
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'always'
          },
          
          // Highlighting
          occurrencesHighlight: 'singleFile',
          selectionHighlight: true,
          
          // Scrollbars
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            useShadows: false,
            verticalHasArrows: false,
            horizontalHasArrows: false
          },
          
          // Bracket matching
          matchBrackets: 'always',
          renderLineHighlight: 'line',
          
          // Code folding
          folding: true,
          foldingHighlight: true,
          
          // Placeholder (simulado via overlay quando vazio)
          ...(!value && placeholder ? {
            'semanticHighlighting.enabled': true
          } : {})
        }}
      />
      
      {/* Placeholder overlay quando não há conteúdo */}
      {!value && placeholder && (
        <div 
          className="absolute top-4 left-12 text-muted-foreground pointer-events-none select-none"
          style={{ fontSize: 14, fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace' }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default SqlCodeEditor;