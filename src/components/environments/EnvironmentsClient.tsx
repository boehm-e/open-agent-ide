'use client';

import { useState } from 'react';
import {
  Rocket,
  User,
  ChevronDown,
  LogOut,
  Plus,
  Search,
  Trash2,
  Save,
  ArrowLeft,
  Variable,
  FileKey,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';

interface Environment {
  id: string;
  name: string;
  description: string | null;
  variables: string; // JSON string
  updatedAt: Date | string;
  createdAt: Date | string;
}

interface VariableEntry {
  key: string;
  value: string;
}

interface EnvironmentsClientProps {
  user: {
    name?: string | null;
    email?: string;
    image?: string | null;
  };
  initialEnvironments: Environment[];
}

function parseVariables(variablesJson: string): VariableEntry[] {
  try {
    const parsed = JSON.parse(variablesJson);
    return Object.entries(parsed).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  } catch {
    return [];
  }
}

function stringifyVariables(entries: VariableEntry[]): string {
  const obj: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.key.trim()) {
      obj[entry.key.trim()] = entry.value;
    }
  }
  return JSON.stringify(obj, null, 2);
}

export default function EnvironmentsClient({ user, initialEnvironments }: EnvironmentsClientProps) {
  const router = useRouter();
  const [environments, setEnvironments] = useState<Environment[]>(initialEnvironments);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [variableEntries, setVariableEntries] = useState<VariableEntry[]>([]);

  const filteredEnvironments = environments.filter((e) => {
    const query = searchQuery.toLowerCase();
    return (
      e.name.toLowerCase().includes(query) ||
      (e.description?.toLowerCase() || '').includes(query)
    );
  });

  const handleCreateEnvironment = () => {
    const newEnvironment: Environment = {
      id: 'new',
      name: 'New Environment',
      description: 'Describe this environment...',
      variables: '{}',
      updatedAt: new Date(),
      createdAt: new Date(),
    };
    setSelectedEnvironment(newEnvironment);
    setVariableEntries([]);
    setIsEditing(true);
  };

  const handleSelectEnvironment = (env: Environment) => {
    setSelectedEnvironment(env);
    setVariableEntries(parseVariables(env.variables));
    setIsEditing(false);
  };

  const handleSaveEnvironment = async () => {
    if (!selectedEnvironment) return;
    setIsSaving(true);
    try {
      const isNew = selectedEnvironment.id === 'new';
      const url = isNew ? '/api/environments' : `/api/environments/${selectedEnvironment.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedEnvironment.name,
          description: selectedEnvironment.description,
          variables: stringifyVariables(variableEntries),
        }),
      });

      if (response.ok) {
        const savedEnvironment = await response.json();
        if (isNew) {
          setEnvironments([savedEnvironment, ...environments]);
        } else {
          setEnvironments(environments.map((e) => (e.id === savedEnvironment.id ? savedEnvironment : e)));
        }
        setSelectedEnvironment(savedEnvironment);
        setVariableEntries(parseVariables(savedEnvironment.variables));
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error saving environment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEnvironment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this environment?')) return;
    try {
      const response = await fetch(`/api/environments/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setEnvironments(environments.filter((e) => e.id !== id));
        if (selectedEnvironment?.id === id) {
          setSelectedEnvironment(null);
          setVariableEntries([]);
          setIsEditing(false);
        }
      }
    } catch (error) {
      console.error('Error deleting environment:', error);
    }
  };

  const addVariableEntry = () => {
    setVariableEntries([...variableEntries, { key: '', value: '' }]);
  };

  const updateVariableEntry = (index: number, field: 'key' | 'value', value: string) => {
    const newEntries = [...variableEntries];
    newEntries[index][field] = value;
    setVariableEntries(newEntries);
  };

  const removeVariableEntry = (index: number) => {
    setVariableEntries(variableEntries.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-primary" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground">Open Web Agent</h1>
                <p className="text-xs text-muted-foreground">Environment Manager</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle className="hidden sm:flex" />
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  {user.image ? (
                    <img src={user.image} alt={user.name || 'User'} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <span className="hidden md:block text-sm font-medium text-foreground">
                    {user.name || user.email}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50 animate-slide-down">
                      <div className="p-2">
                        <div className="px-2 py-3 border-b border-border mb-2">
                          <p className="text-sm font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <button
                          onClick={() => signOut({ callbackUrl: '/login' })}
                          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Environments</h2>
            <p className="text-muted-foreground">Manage custom environment variables for your workspaces</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar - Environments List */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search environments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
              </div>
              <Button onClick={handleCreateEnvironment} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {filteredEnvironments.map((env) => (
                <Card
                  key={env.id}
                  className={cn(
                    'cursor-pointer transition-all hover:border-primary/50',
                    selectedEnvironment?.id === env.id && 'border-primary bg-primary/5'
                  )}
                  onClick={() => handleSelectEnvironment(env)}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{env.name}</CardTitle>
                        <CardDescription className="text-xs line-clamp-2 mt-1">
                          {env.description || 'No description'}
                        </CardDescription>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <FileKey className="w-3 h-3" />
                          <span>{Object.keys(JSON.parse(env.variables || '{}')).length} variables</span>
                        </div>
                      </div>
                      <Variable className="w-4 h-4 text-primary shrink-0" />
                    </div>
                  </CardHeader>
                </Card>
              ))}
              {filteredEnvironments.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                  <Variable className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No environments found</p>
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Editor/Viewer */}
          <div className="lg:col-span-8">
            {selectedEnvironment ? (
              <Card className="h-full flex flex-col">
                <CardHeader className="border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {isEditing ? (
                        <input
                          value={selectedEnvironment.name}
                          onChange={(e) =>
                            setSelectedEnvironment({ ...selectedEnvironment, name: e.target.value })
                          }
                          className="text-xl font-bold bg-transparent border-none focus:outline-none w-full"
                          placeholder="Environment Name"
                        />
                      ) : (
                        <CardTitle className="text-xl">{selectedEnvironment.name}</CardTitle>
                      )}
                      {isEditing ? (
                        <input
                          value={selectedEnvironment.description || ''}
                          onChange={(e) =>
                            setSelectedEnvironment({ ...selectedEnvironment, description: e.target.value })
                          }
                          className="text-sm text-muted-foreground bg-transparent border-none focus:outline-none w-full mt-1"
                          placeholder="Environment Description"
                        />
                      ) : (
                        <CardDescription className="mt-1">
                          {selectedEnvironment.description || 'No description'}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Button variant="ghost" onClick={() => setIsEditing(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSaveEnvironment} disabled={isSaving} className="gap-2">
                            <Save className="w-4 h-4" />
                            {isSaving ? 'Saving...' : 'Save Environment'}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => setIsEditing(true)}>
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteEnvironment(selectedEnvironment.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-foreground">Environment Variables</h3>
                        <Button variant="outline" size="sm" onClick={addVariableEntry} className="gap-1">
                          <Plus className="w-3 h-3" />
                          Add Variable
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {variableEntries.map((entry, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="KEY"
                              value={entry.key}
                              onChange={(e) => updateVariableEntry(index, 'key', e.target.value)}
                              className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <span className="text-muted-foreground">=</span>
                            <input
                              type="text"
                              placeholder="value"
                              value={entry.value}
                              onChange={(e) => updateVariableEntry(index, 'value', e.target.value)}
                              className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeVariableEntry(index)}
                              className="shrink-0"
                            >
                              <Trash2 className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                        {variableEntries.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No variables yet. Click "Add Variable" to add environment variables.
                          </p>
                        )}
                      </div>
                      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">Preview (.env format)</h4>
                        <pre className="text-xs font-mono text-muted-foreground overflow-auto">
                          {variableEntries
                            .filter((e) => e.key.trim())
                            .map((e) => `${e.key.trim()}=${e.value}`)
                            .join('\n') || '# No variables defined'}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-medium text-foreground mb-3">Environment Variables</h3>
                        <div className="bg-muted/50 rounded-lg p-4">
                          {variableEntries.length > 0 ? (
                            <div className="space-y-2">
                              {variableEntries.map((entry, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 text-sm font-mono"
                                >
                                  <span className="text-primary">{entry.key}</span>
                                  <span className="text-muted-foreground">=</span>
                                  <span className="text-foreground">{entry.value}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No variables defined</p>
                          )}
                        </div>
                      </div>
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-sm text-blue-500">
                          <strong>Tip:</strong> Link this environment to workspaces from the dashboard to
                          automatically inject these variables into your containers.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-24 border-2 border-dashed border-border rounded-2xl bg-muted/10">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Variable className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Select an environment to view or edit
                </h3>
                <p className="text-muted-foreground mb-8 max-w-sm text-center">
                  Environments allow you to define custom environment variables that can be injected into
                  your workspace containers.
                </p>
                <Button onClick={handleCreateEnvironment} className="gap-2">
                  <Plus className="w-5 h-5" />
                  Create New Environment
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
