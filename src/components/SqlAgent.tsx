"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Brain, Send, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DatabaseConfig } from "@/services/api";

interface SqlAgentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateSql: (sql: string) => void;
  currentDatabase?: string;
}

const SqlAgent = ({ open, onOpenChange, onGenerateSql, currentDatabase }: SqlAgentProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini"); // Default to Gemini
  const [isGenerating, setIsGenerating] = useState(false);
  const [config, setConfig] = useState<DatabaseConfig['ai'] | null>(null); // To store AI API keys
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");
  const [loadingDatabases, setLoadingDatabases] = useState(false);

  useEffect(() => {
    // Load AI config from API
    const loadAiConfig = async () => {
      try {
        const aiConfig = await apiService.getAiConfig();
        setConfig(aiConfig);
      } catch (e) {
        console.error("Failed to load AI config from API", e);
        // Fallback to localStorage for backwards compatibility
        try {
          const savedConfigJson = localStorage.getItem('database-config');
          if (savedConfigJson) {
            const savedConfig = JSON.parse(savedConfigJson);
            setConfig(savedConfig.ai);
          }
        } catch (fallbackError) {
          console.error("Failed to load AI config from localStorage", fallbackError);
        }
      }
    };

    loadAiConfig();
  }, []);

  // Load databases when dialog opens
  useEffect(() => {
    const loadDatabases = async () => {
      setLoadingDatabases(true);
      try {
        const databaseList = await apiService.getDatabases();
        setDatabases(databaseList);
      } catch (error) {
        console.error("Error loading databases:", error);
        toast({
          title: t("sqlAgent.errorLoadingDatabases"),
          description: t("sqlAgent.failedToLoadDatabases"),
          variant: "destructive",
        });
      } finally {
        setLoadingDatabases(false);
      }
    };

    if (open) {
      loadDatabases();
      // Set current database as selected if provided, otherwise set to "__none__"
      if (currentDatabase) {
        setSelectedDatabase(currentDatabase);
      } else {
        setSelectedDatabase("__none__");
      }
    }
  }, [open, currentDatabase, t, toast]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: t("sqlAgent.promptRequired"),
        description: t("sqlAgent.pleaseEnterPrompt"),
        variant: "destructive",
      });
      return;
    }

    if (!config || (!config.geminiApiKey && !config.openAIApiKey && !config.anthropicApiKey)) {
      toast({
        title: t("sqlAgent.apiKeysMissing"),
        description: t("sqlAgent.configureApiKeys"),
        variant: "destructive",
      });
      return;
    }

    // Check if the selected model has its API key configured
    let apiKeyPresent = false;
    if (selectedModel === 'gemini' && config.geminiApiKey) apiKeyPresent = true;
    if (selectedModel === 'openAI' && config.openAIApiKey) apiKeyPresent = true;
    if (selectedModel === 'anthropic' && config.anthropicApiKey) apiKeyPresent = true;

    if (!apiKeyPresent) {
      toast({
        title: t("sqlAgent.apiKeyMissingForModel"),
        description: t("sqlAgent.configureApiKeyForSelectedModel", { model: selectedModel }),
        variant: "destructive",
      });
      return;
    }

    // Allow generation without database context, but with warning
    // The backend will handle this case gracefully

    setIsGenerating(true);
    try {
      // Use selectedDatabase, but convert "__none__" to undefined
      const databaseToUse = selectedDatabase === "__none__" ? undefined : selectedDatabase;
      const result = await apiService.generateSqlWithAi(prompt, selectedModel, databaseToUse);
      if (result.success) {
        onGenerateSql(result.sql);
        toast({
          title: t("sqlAgent.sqlGenerated"),
          description: t("sqlAgent.sqlGeneratedSuccessfully"),
        });
        onOpenChange(false); // Close dialog on successful generation
      } else {
        throw new Error(result.message || t("sqlAgent.failedToGenerateSql"));
      }
    } catch (error) {
      console.error("Error generating SQL with AI:", error);
      toast({
        title: t("sqlAgent.errorGeneratingSql"),
        description: error instanceof Error ? error.message : t("sqlAgent.failedToGenerateSql"),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isGenerating) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" /> {t("sqlAgent.title")}
          </DialogTitle>
          <DialogDescription>{t("sqlAgent.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Database Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("sqlAgent.selectDatabase")}:</label>
            <Select value={selectedDatabase} onValueChange={setSelectedDatabase} disabled={isGenerating || loadingDatabases}>
              <SelectTrigger>
                <SelectValue placeholder={loadingDatabases ? t("sqlAgent.loadingDatabases") : t("sqlAgent.selectDatabasePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("sqlAgent.noDatabaseSelected")}</SelectItem>
                {databases.map((db) => (
                  <SelectItem key={db} value={db}>{db}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDatabase && selectedDatabase !== "__none__" ? (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {t("sqlAgent.databaseContextInfo")}
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-2">
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  {t("sqlAgent.noDatabaseContextWarning")}
                </p>
              </div>
            )}
          </div>
          <Textarea
            placeholder={t("sqlAgent.promptPlaceholder")}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            disabled={isGenerating}
          />
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isGenerating}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("sqlAgent.selectAiModel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="openAI">OpenAI (GPT)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="flex-1">
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {isGenerating ? t("sqlAgent.generatingSql") : t("sqlAgent.generateSql")}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            <XCircle className="h-4 w-4 mr-2" />
            {t("sqlAgent.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SqlAgent;