import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, ArrowLeft, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';

interface SetupStep {
  id: string;
  title: string;
  description: string;
}

interface RootConnection {
  host: string;
  port: number;
  username: string;
  password: string;
}

interface SystemDatabase {
  name: string;
  encoding: string;
  collation: string;
}

interface SystemUser {
  username: string;
  password: string;
  host: string;
}

const InitialSetupWizard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Step 1: Language Selection
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en');
  const availableLanguages = [
    { code: 'en', name: 'English' },
    { code: 'pt-BR', name: 'Português (Brasil)' }
  ];

  // Step 2: Root Database Connection
  const [rootConnection, setRootConnection] = useState<RootConnection>({
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  // Step 3: System Database Creation (fixed values)
  const systemDatabase = {
    name: 'javascriptmyadmin_meta',
    encoding: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci'
  };

  // Step 4: System User Creation
  const [systemUser, setSystemUser] = useState<SystemUser>({
    username: 'jsMyAdmin_user',
    password: '',
    host: '%'
  });
  const [confirmPassword, setConfirmPassword] = useState('');

  const steps: SetupStep[] = [
    {
      id: 'language',
      title: t('setup.languageStep.title', 'Language Selection'),
      description: t('setup.languageStep.description', 'Choose your preferred language for the interface')
    },
    {
      id: 'connection',
      title: t('setup.connectionStep.title', 'Database Connection'),
      description: t('setup.connectionStep.description', 'Configure connection to MySQL root user')
    },
    {
      id: 'database',
      title: t('setup.databaseStep.title', 'System Database'),
      description: t('setup.databaseStep.description', 'Create a database for system data')
    },
    {
      id: 'user',
      title: t('setup.userStep.title', 'System User'),
      description: t('setup.userStep.description', 'Create a dedicated user for the application')
    },
    {
      id: 'environment',
      title: t('setup.environmentStep.title', 'Finalize Setup'),
      description: t('setup.environmentStep.description', 'Save configuration and start the application')
    }
  ];

  const currentStep = steps[currentStepIndex];

  // Clear alerts when changing steps
  useEffect(() => {
    setError(null);
    setSuccess(null);
    // Reset confirm password when changing steps
    if (currentStepIndex !== 3) { // Not on user step
      setConfirmPassword('');
    }
  }, [currentStepIndex]);

  // Generate secure password safe for .env files
  const generatePassword = (length: number = 16): string => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    // Safe symbols for .env files (avoiding quotes, backslashes, spaces, etc.)
    const symbols = '!@#$%^&*()_+-={}[]';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  // Generate session key with only alphanumeric and basic safe symbols
  const generateSessionKey = (length: number = 64): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let key = '';
    
    for (let i = 0; i < length; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    
    return key;
  };

  const handleLanguageChange = (value: string) => {
    setSelectedLanguage(value);
  };

  const confirmLanguageSelection = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await i18n.changeLanguage(selectedLanguage);
      setSuccess(t('setup.languageStep.success', 'Language updated successfully!'));
      setCompletedSteps(prev => [...prev.filter(id => id !== 'language'), 'language']);
      
      // Add delay for visual feedback
      setTimeout(() => {
        setCurrentStepIndex(1);
        setLoading(false);
      }, 1000);
    } catch (err) {
      setError(t('setup.languageStep.error', 'Failed to update language'));
      setLoading(false);
    }
  };

  const testRootConnection = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiService.testRootConnection(rootConnection);
      
      if (response.success) {
        setSuccess(t('setup.connectionStep.success', 'Connection successful!'));
        setCompletedSteps(prev => [...prev.filter(id => id !== 'connection'), 'connection']);
        
        // Add delay for visual feedback
        setTimeout(() => {
          setCurrentStepIndex(2);
          setLoading(false);
        }, 1000);
      } else {
        setError(response.message || t('setup.connectionStep.error', 'Connection failed'));
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.connectionStep.error', 'Connection error'));
      setLoading(false);
    }
  };

  const createSystemDatabase = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiService.createSystemDatabase(rootConnection);
      
      if (response.success) {
        setSuccess(t('setup.databaseStep.success', 'Database created successfully!'));
        setCompletedSteps(prev => [...prev.filter(id => id !== 'database'), 'database']);
        
        // Add delay for visual feedback
        setTimeout(() => {
          setCurrentStepIndex(3);
          setLoading(false);
        }, 1000);
      } else {
        setError(response.message || t('setup.databaseStep.error', 'Failed to create database'));
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.databaseStep.error', 'Error creating database'));
      setLoading(false);
    }
  };

  const createSystemUser = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiService.createSystemUser(rootConnection, systemUser);
      
      if (response.success) {
        setSuccess(t('setup.userStep.success', 'User created successfully!'));
        setCompletedSteps(prev => [...prev.filter(id => id !== 'user'), 'user']);
        
        // Add delay for visual feedback
        setTimeout(() => {
          setCurrentStepIndex(4);
          setLoading(false);
        }, 1000);
      } else {
        setError(response.message || t('setup.userStep.error', 'Failed to create user'));
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.userStep.error', 'Error creating user'));
      setLoading(false);
    }
  };

  const finalizeSetup = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiService.finalizeSystemSetup({
        systemUser,
        sessionSecretKey: generateSessionKey(64),
        language: selectedLanguage
      });
      
      if (response.success) {
        setSuccess(t('setup.environmentStep.success', 'Initial setup completed successfully! Redirecting to login...'));
        setCompletedSteps(prev => [...prev.filter(id => id !== 'environment'), 'environment']);
        
        // Wait a moment to show success message, then redirect to login
        setTimeout(() => {
          // Instead of reloading, we'll update the app state to trigger a re-check
          window.dispatchEvent(new CustomEvent('setupCompleted'));
          setLoading(false);
        }, 2500);
      } else {
        setError(response.message || t('setup.environmentStep.error', 'Failed to finalize setup'));
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.environmentStep.error', 'Error finalizing setup'));
      setLoading(false);
    }
  };

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'language':
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('setup.languageStep.instruction', 'Please select your preferred language for the application')}
            </div>
            <div className="space-y-2">
              <Label>{t('setup.languageStep.selectLabel', 'Select Language')}</Label>
              <Select 
                value={selectedLanguage} 
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('setup.languageStep.selectPlaceholder', 'Choose a language')} />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={confirmLanguageSelection} 
              className="w-full"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('setup.languageStep.continueButton', 'Continue')}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        );

      case 'connection':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">{t('setup.connectionStep.host', 'Host')}</Label>
                <Input
                  id="host"
                  value={rootConnection.host}
                  onChange={(e) => setRootConnection(prev => ({ ...prev, host: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">{t('setup.connectionStep.port', 'Port')}</Label>
                <Input
                  id="port"
                  type="number"
                  value={rootConnection.port}
                  onChange={(e) => setRootConnection(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">{t('setup.connectionStep.username', 'Username')}</Label>
              <Input
                id="username"
                value={rootConnection.username}
                onChange={(e) => setRootConnection(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('setup.connectionStep.password', 'Password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={rootConnection.password}
                  onChange={(e) => setRootConnection(prev => ({ ...prev, password: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={goToPreviousStep} variant="outline" disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('setup.previousButton', 'Previous')}
              </Button>
              <Button 
                onClick={testRootConnection} 
                className="flex-1"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('setup.connectionStep.testButton', 'Test Connection')}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        );

      case 'database':
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('setup.databaseStep.instruction', 'The system database will be created automatically with default settings.')}
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div><strong>{t('setup.databaseStep.nameLabel', 'Database Name')}:</strong> javascriptmyadmin_meta</div>
              <div><strong>{t('setup.databaseStep.encodingLabel', 'Character Set')}:</strong> utf8mb4</div>
              <div><strong>{t('setup.databaseStep.collationLabel', 'Collation')}:</strong> utf8mb4_unicode_ci</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={goToPreviousStep} variant="outline" disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('setup.previousButton', 'Previous')}
              </Button>
              <Button 
                onClick={createSystemDatabase} 
                className="flex-1"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('setup.databaseStep.createButton', 'Create Database')}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        );

      case 'user':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('setup.userStep.username', 'Username')}</Label>
              <Input
                id="username"
                value={systemUser.username}
                onChange={(e) => setSystemUser(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('setup.userStep.password', 'Password')}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={systemUser.password}
                    onChange={(e) => {
                      setSystemUser(prev => ({ ...prev, password: e.target.value }));
                      setConfirmPassword('');
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const newPassword = generatePassword();
                    setSystemUser(prev => ({ ...prev, password: newPassword }));
                    setConfirmPassword(newPassword);
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-xs text-gray-500">
                {t('setup.userStep.passwordHint', 'Click the refresh button to generate a secure password')}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('setup.userStep.confirmPassword', 'Confirm Password')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {confirmPassword && systemUser.password !== confirmPassword && (
                <div className="text-xs text-red-500">
                  {t('setup.userStep.passwordMismatch', 'Passwords do not match')}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={goToPreviousStep} variant="outline" disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('setup.previousButton', 'Previous')}
              </Button>
              <Button 
                onClick={createSystemUser} 
                className="flex-1"
                disabled={loading || !systemUser.password || systemUser.password !== confirmPassword}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('setup.userStep.createButton', 'Create User')}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        );

      case 'environment':
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('setup.environmentStep.instruction', 'Review your configuration and finalize the setup')}
            </div>
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div><strong>{t('setup.environmentStep.connection', 'Connection')}:</strong> {rootConnection.username}@{rootConnection.host}:{rootConnection.port}</div>
              <div><strong>{t('setup.environmentStep.database', 'Database')}:</strong> javascriptmyadmin_meta</div>
              <div><strong>{t('setup.environmentStep.user', 'User')}:</strong> {systemUser.username}@{systemUser.host}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={goToPreviousStep} variant="outline" disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('setup.previousButton', 'Previous')}
              </Button>
              <Button 
                onClick={finalizeSetup} 
                className="flex-1"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('setup.environmentStep.finalizeButton', 'Finalize Setup')}
                {!loading && <CheckCircle2 className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            {t('setup.title', 'jsMyAdmin Initial Setup')}
          </CardTitle>
          <CardDescription className="text-center">
            {t('setup.description', 'Configure your MySQL administration interface')}
          </CardDescription>
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">
                {t('setup.progressLabel', 'Progress')}: {currentStepIndex + 1}/{steps.length}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              {completedSteps.includes(currentStep.id) && (
                <CheckCircle2 className="mr-2 h-5 w-5 text-green-600" />
              )}
              {currentStep.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{currentStep.description}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {renderStepContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default InitialSetupWizard;