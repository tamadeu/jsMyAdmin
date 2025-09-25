"use client";

import React from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-sql'; // Import SQL language for Prism
import 'prismjs/themes/prism.css'; // Basic Prism theme, can be customized or replaced with Tailwind

interface SqlCodeEditorProps {
  value: string;
  onValueChange: (code: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>) => void;
  placeholder?: string;
  readOnly?: boolean;
}

const SqlCodeEditor = ({ value, onValueChange, onKeyDown, placeholder, readOnly }: SqlCodeEditorProps) => {
  return (
    <Editor
      value={value}
      onValueChange={onValueChange}
      highlight={code => highlight(code, languages.sql, 'sql')}
      padding={10}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      readOnly={readOnly}
      style={{
        fontFamily: '"Fira code", "Fira Mono", monospace',
        fontSize: 14,
        backgroundColor: 'hsl(var(--muted))', // Using Tailwind color variable
        borderRadius: '0.5rem', // Tailwind rounded-lg
        border: '1px solid hsl(var(--border))', // Tailwind border
        minHeight: '30vh',
        overflow: 'auto',
      }}
      textareaClassName="focus:outline-none" // Remove default textarea focus outline
      preClassName="prism-code" // Class for Prism to apply styles
    />
  );
};

export default SqlCodeEditor;