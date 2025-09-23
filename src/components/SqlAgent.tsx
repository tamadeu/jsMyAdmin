"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Brain, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

interface SqlAgentProps {
  onGenerateSql: (sql: string) => void;
  currentDatabase?: string;
}

const SqlAgent = ({ onGenerateSql, currentDatabase }: SqlAgentProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini"); // Default to Gemini
  const [isGenerating, setIsGenerating] = useState(false);
  const [config, setConfig] = useState<any>(null); // To store AI API keys

  useEffect(() => {
    // Load AI config from localStorage
    try {
      const savedConfigJson = localStorage.getItem('database-config');
      if (savedConfigJson) {
        const savedConfig = JSON.parse(savedConfigJson);
        setConfig(savedConfig.ai);
      }
    } catch (e) {
      console.error("Failed to load AI config from localStorage", e);
    }
  }, []);

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
    if (selectedModel === 'openai' && config.openAIApiKey) apiKeyPresent = true;
    if (selectedModel === 'anthropic' && config.anthropicApiKey) apiKeyPresent = true;

    if (!apiKeyPresent) {
      toast({
        title: t("sqlAgent.apiKeyMissingForModel"),
        description: t("sqlAgent.configureApiKeyForSelectedModel", { model: selectedModel }),
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await apiService.generateSqlWithAi(prompt, selectedModel, currentDatabase);
      if (result.success) {
        onGenerateSql(result.sql);
        toast({
          title: t("sqlAgent.sqlGenerated"),
          description: t("sqlAgent.sqlGeneratedSuccessfully"),
        });
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" /> {t("sqlAgent.title")}
        </CardTitle>
        <CardDescription>{t("sqlAgent.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              <SelectItem value="openai">OpenAI (GPT)</SelectItem>
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
      </CardContent>
    </Card>
  );
};

export default SqlAgent;