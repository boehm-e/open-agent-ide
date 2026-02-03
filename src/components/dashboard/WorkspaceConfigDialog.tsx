'use client';

import { useState, useEffect } from 'react';
import { X, Variable, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface Environment {
  id: string;
  name: string;
  description: string | null;
  variables: string;
}

interface WorkspaceConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

export default function WorkspaceConfigDialog({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
}: WorkspaceConfigDialogProps) {
  const [availableEnvironments, setAvailableEnvironments] = useState<Environment[]>([]);
  const [linkedEnvironmentIds, setLinkedEnvironmentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && workspaceId) {
      loadData();
    }
  }, [isOpen, workspaceId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all available environments
      const envResponse = await fetch('/api/environments');
      if (!envResponse.ok) throw new Error('Failed to fetch environments');
      const environments = await envResponse.json();
      setAvailableEnvironments(environments);

      // Fetch currently linked environments
      const linkedResponse = await fetch(`/api/workspaces/${workspaceId}/environments`);
      if (!linkedResponse.ok) throw new Error('Failed to fetch linked environments');
      const { environments: linked } = await linkedResponse.json();
      setLinkedEnvironmentIds(linked.map((e: Environment) => e.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEnvironment = (envId: string) => {
    setLinkedEnvironmentIds((prev) =>
      prev.includes(envId) ? prev.filter((id) => id !== envId) : [...prev, envId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/environments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentIds: linkedEnvironmentIds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update environments');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const getVariableCount = (env: Environment) => {
    try {
      return Object.keys(JSON.parse(env.variables)).length;
    } catch {
      return 0;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col animate-slide-down">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Workspace Configuration</CardTitle>
              <CardDescription className="mt-1">
                Configure environments for <strong>{workspaceName}</strong>
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" onClick={loadData} className="mt-4">
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                  <Variable className="w-4 h-4" />
                  Linked Environments
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select environments to inject their variables into this workspace's containers.
                  Variables from multiple environments will be merged (later environments override
                  earlier ones).
                </p>

                {availableEnvironments.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                    <Variable className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No environments available.{' '}
                      <a href="/environments" className="text-primary hover:underline">
                        Create one first
                      </a>
                      .
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableEnvironments.map((env) => {
                      const isLinked = linkedEnvironmentIds.includes(env.id);
                      const varCount = getVariableCount(env);

                      return (
                        <div
                          key={env.id}
                          onClick={() => handleToggleEnvironment(env.id)}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                            isLinked
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          )}
                        >
                          <div
                            className={cn(
                              'w-5 h-5 rounded border flex items-center justify-center transition-colors',
                              isLinked
                                ? 'bg-primary border-primary'
                                : 'border-border bg-background'
                            )}
                          >
                            {isLinked && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{env.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({varCount} variables)
                              </span>
                            </div>
                            {env.description && (
                              <p className="text-sm text-muted-foreground truncate">
                                {env.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {linkedEnvironmentIds.length > 0 && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-500">
                    <strong>Note:</strong> Changes to environment variables will take effect the next
                    time the workspace is restarted. Variables from multiple environments are merged
                    in the order selected.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <div className="p-6 border-t border-border flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isSaving} className="gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Configuration
          </Button>
        </div>
      </Card>
    </div>
  );
}
