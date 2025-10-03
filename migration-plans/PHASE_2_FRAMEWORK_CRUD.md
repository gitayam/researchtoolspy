# Phase 2: Framework CRUD Operations

**Phase:** 2 of 7
**Duration:** 1-2 weeks
**Status:** Ready to Start
**Prerequisites:** Phase 1 (Infrastructure) ✅ Complete
**Team Size:** 1-2 developers

---

## 🎯 Objectives

Build a complete CRUD system for analysis frameworks, starting with simple frameworks and establishing patterns for complex ones.

### Success Criteria
- [ ] SWOT Analysis fully functional (create, read, update, delete)
- [ ] Generic framework form system working
- [ ] D1 database persistence operational
- [ ] 5 simple frameworks migrated and tested
- [ ] List/View/Edit/Delete flows working
- [ ] Form validation with Zod
- [ ] Error handling implemented
- [ ] Loading states and optimistic updates

---

## 📋 Framework Priority Matrix

### Priority 0: SWOT (Start Here)
**Why:** Simplest framework, 4-quadrant structure, good learning case
**Complexity:** Low
**Data Structure:** Simple object with 4 arrays
**Time Estimate:** 1-2 days

### Priority 1: Simple Frameworks (Week 1)
1. **PEST Analysis** - 4 quadrants (Political, Economic, Social, Technical)
2. **DIME** - 4 dimensions (Diplomatic, Information, Military, Economic)
3. **Starbursting** - Question-based (Who, What, When, Where, Why, How)
4. **VRIO** - Resource evaluation (Value, Rarity, Imitability, Organization)
5. **Trend Analysis** - Timeline-based trends

**Common Pattern:** All use simple lists or matrices

### Priority 2: Medium Complexity (Week 2)
6. **Behavior Analysis** - Multiple behavior patterns
7. **DOTMLPF** - 7-dimension military framework
8. **Stakeholder Analysis** - Stakeholder list with attributes
9. **Surveillance** - Observation tracking
10. **Fundamental Flow** - Process flow analysis

---

## 🏗️ Architecture Design

### Component Structure

```
src/
├── components/
│   ├── frameworks/
│   │   ├── shared/
│   │   │   ├── FrameworkForm.tsx           # Generic form wrapper
│   │   │   ├── FrameworkList.tsx           # Generic list component
│   │   │   ├── FrameworkView.tsx           # Generic view component
│   │   │   ├── FrameworkCard.tsx           # List item card
│   │   │   ├── QuadrantLayout.tsx          # 4-quadrant reusable component
│   │   │   ├── MatrixInput.tsx             # Matrix input component
│   │   │   ├── ListInput.tsx               # Dynamic list input
│   │   │   └── FrameworkActions.tsx        # Action buttons (edit/delete/export)
│   │   │
│   │   ├── swot/
│   │   │   ├── SwotForm.tsx                # SWOT create/edit form
│   │   │   ├── SwotView.tsx                # SWOT view page
│   │   │   ├── SwotQuadrant.tsx            # Individual quadrant
│   │   │   └── SwotExport.tsx              # Export functionality
│   │   │
│   │   ├── pest/
│   │   │   ├── PestForm.tsx
│   │   │   └── PestView.tsx
│   │   │
│   │   └── [other-frameworks]/
│   │
│   └── ui/                                  # Radix UI components (already exists)
│
├── lib/
│   ├── api/
│   │   └── frameworks.ts                    # Framework API client
│   ├── schemas/
│   │   ├── framework-base.schema.ts         # Base Zod schema
│   │   ├── swot.schema.ts                   # SWOT-specific schema
│   │   └── [other-schemas].ts
│   ├── exports/
│   │   └── framework-export.ts              # Export utilities
│   └── utils/
│       └── framework-helpers.ts             # Helper functions
│
├── pages/
│   └── frameworks/
│       ├── FrameworksPage.tsx               # All frameworks list
│       ├── SwotListPage.tsx                 # SWOT list page
│       ├── SwotCreatePage.tsx               # SWOT create page
│       ├── SwotEditPage.tsx                 # SWOT edit page
│       └── SwotViewPage.tsx                 # SWOT view page
│
├── hooks/
│   ├── useFramework.ts                      # Single framework hook
│   ├── useFrameworks.ts                     # List of frameworks hook
│   ├── useCreateFramework.ts                # Create mutation hook
│   ├── useUpdateFramework.ts                # Update mutation hook
│   └── useDeleteFramework.ts                # Delete mutation hook
│
├── types/
│   ├── framework.types.ts                   # Base framework types
│   ├── swot.types.ts                        # SWOT-specific types
│   └── [other-framework].types.ts
│
└── stores/
    └── framework.store.ts                   # Framework state management (if needed)
```

### Data Flow

```
User Action
    ↓
Page Component (e.g., SwotCreatePage)
    ↓
Form Component (e.g., SwotForm with React Hook Form)
    ↓
Validation (Zod schema)
    ↓
Custom Hook (e.g., useCreateFramework)
    ↓
TanStack Query Mutation
    ↓
API Client (axios)
    ↓
Cloudflare Pages Function (/api/frameworks)
    ↓
D1 Database
    ↓
Response
    ↓
Cache Update (TanStack Query)
    ↓
UI Update (React re-render)
```

---

## 💻 Implementation Steps

### Step 1: Data Models & Types (Day 1 Morning)

**File:** `src/types/framework.types.ts`
```typescript
export type FrameworkType =
  | 'swot'
  | 'pest'
  | 'dime'
  | 'starbursting'
  | 'vrio'
  | 'trend'
  | 'behavior'
  | 'dotmlpf'
  | 'stakeholder'
  | 'surveillance'
  | 'fundamental-flow'
  | 'ach'
  | 'cog'
  | 'pmesii-pt'
  | 'causeway'
  | 'deception';

export interface BaseFramework {
  id: string;
  userId?: string;
  frameworkType: FrameworkType;
  name: string;
  description?: string;
  data: unknown; // Framework-specific data
  createdAt: string;
  updatedAt: string;
}

export interface FrameworkListItem {
  id: string;
  frameworkType: FrameworkType;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

**File:** `src/types/swot.types.ts`
```typescript
export interface SwotData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface SwotFramework extends BaseFramework {
  frameworkType: 'swot';
  data: SwotData;
}

export interface SwotFormData {
  name: string;
  description?: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}
```

**Testing:**
- [ ] TypeScript compilation succeeds
- [ ] Types imported correctly in other files

---

### Step 2: Zod Validation Schemas (Day 1 Morning)

**File:** `src/lib/schemas/framework-base.schema.ts`
```typescript
import { z } from 'zod';

export const frameworkTypeSchema = z.enum([
  'swot', 'pest', 'dime', 'starbursting', 'vrio', 'trend',
  'behavior', 'dotmlpf', 'stakeholder', 'surveillance',
  'fundamental-flow', 'ach', 'cog', 'pmesii-pt', 'causeway', 'deception'
]);

export const baseFrameworkSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  frameworkType: frameworkTypeSchema,
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  data: z.unknown(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
```

**File:** `src/lib/schemas/swot.schema.ts`
```typescript
import { z } from 'zod';
import { baseFrameworkSchema } from './framework-base.schema';

export const swotDataSchema = z.object({
  strengths: z.array(z.string()).min(0),
  weaknesses: z.array(z.string()).min(0),
  opportunities: z.array(z.string()).min(0),
  threats: z.array(z.string()).min(0),
});

export const swotFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().optional(),
  strengths: z.array(z.string()).min(1, 'Add at least one strength'),
  weaknesses: z.array(z.string()).min(1, 'Add at least one weakness'),
  opportunities: z.array(z.string()).min(1, 'Add at least one opportunity'),
  threats: z.array(z.string()).min(1, 'Add at least one threat'),
});

export const swotFrameworkSchema = baseFrameworkSchema.extend({
  frameworkType: z.literal('swot'),
  data: swotDataSchema,
});

export type SwotFormInput = z.infer<typeof swotFormSchema>;
```

**Testing:**
- [ ] Schema validation works with valid data
- [ ] Schema rejects invalid data
- [ ] Error messages are helpful

---

### Step 3: API Client (Day 1 Afternoon)

**File:** `src/lib/api/frameworks.ts`
```typescript
import axios from 'axios';
import type { BaseFramework, FrameworkListItem, FrameworkType } from '@/types/framework.types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const frameworksApi = {
  // List all frameworks
  list: async (type?: FrameworkType): Promise<FrameworkListItem[]> => {
    const params = type ? { type } : {};
    const response = await axios.get(`${API_BASE}/frameworks`, { params });
    return response.data;
  },

  // Get single framework
  get: async (id: string): Promise<BaseFramework> => {
    const response = await axios.get(`${API_BASE}/frameworks/${id}`);
    return response.data;
  },

  // Create framework
  create: async (data: Omit<BaseFramework, 'id' | 'createdAt' | 'updatedAt'>): Promise<BaseFramework> => {
    const response = await axios.post(`${API_BASE}/frameworks`, data);
    return response.data;
  },

  // Update framework
  update: async (id: string, data: Partial<BaseFramework>): Promise<BaseFramework> => {
    const response = await axios.put(`${API_BASE}/frameworks/${id}`, data);
    return response.data;
  },

  // Delete framework
  delete: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE}/frameworks/${id}`);
  },
};
```

**Testing:**
- [ ] API calls work with local dev server
- [ ] Error handling catches network errors
- [ ] TypeScript types are correct

---

### Step 4: React Query Hooks (Day 1 Afternoon)

**File:** `src/hooks/useFrameworks.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { frameworksApi } from '@/lib/api/frameworks';
import type { FrameworkType } from '@/types/framework.types';

export function useFrameworks(type?: FrameworkType) {
  return useQuery({
    queryKey: ['frameworks', type],
    queryFn: () => frameworksApi.list(type),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**File:** `src/hooks/useFramework.ts`
```typescript
import { useQuery } from '@tanstack/react-query';
import { frameworksApi } from '@/lib/api/frameworks';

export function useFramework(id: string) {
  return useQuery({
    queryKey: ['frameworks', id],
    queryFn: () => frameworksApi.get(id),
    enabled: !!id,
  });
}
```

**File:** `src/hooks/useCreateFramework.ts`
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { frameworksApi } from '@/lib/api/frameworks';
import type { BaseFramework } from '@/types/framework.types';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export function useCreateFramework() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: Omit<BaseFramework, 'id' | 'createdAt' | 'updatedAt'>) =>
      frameworksApi.create(data),
    onSuccess: (newFramework) => {
      // Invalidate frameworks list
      queryClient.invalidateQueries({ queryKey: ['frameworks'] });

      // Show success toast
      toast({
        title: 'Framework created',
        description: `${newFramework.name} has been created successfully.`,
      });

      // Navigate to view page
      navigate(`/frameworks/${newFramework.frameworkType}/${newFramework.id}`);
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating framework',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });
}
```

**File:** `src/hooks/useUpdateFramework.ts`
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { frameworksApi } from '@/lib/api/frameworks';
import type { BaseFramework } from '@/types/framework.types';
import { toast } from '@/hooks/use-toast';

export function useUpdateFramework() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BaseFramework> }) =>
      frameworksApi.update(id, data),
    onSuccess: (updatedFramework) => {
      // Update cache
      queryClient.setQueryData(['frameworks', updatedFramework.id], updatedFramework);
      queryClient.invalidateQueries({ queryKey: ['frameworks'] });

      toast({
        title: 'Framework updated',
        description: 'Changes saved successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating framework',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });
}
```

**File:** `src/hooks/useDeleteFramework.ts`
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { frameworksApi } from '@/lib/api/frameworks';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export function useDeleteFramework() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (id: string) => frameworksApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['frameworks'] });
      queryClient.removeQueries({ queryKey: ['frameworks', deletedId] });

      toast({
        title: 'Framework deleted',
        description: 'Framework has been deleted successfully.',
      });

      navigate('/frameworks');
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting framework',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });
}
```

**Testing:**
- [ ] Hooks work with React Query DevTools
- [ ] Cache invalidation works correctly
- [ ] Optimistic updates (if implemented) work
- [ ] Error handling shows toast messages

---

### Step 5: Shared Components (Day 2 Morning)

**File:** `src/components/frameworks/shared/ListInput.tsx`
```typescript
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ListInputProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export function ListInput({
  label,
  items,
  onChange,
  placeholder = 'Add item',
  required = false,
  error
}: ListInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addItem = () => {
    if (inputValue.trim()) {
      onChange([...items, inputValue.trim()]);
      setInputValue('');
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  return (
    <div className="space-y-2">
      <Label className={required ? 'required' : ''}>
        {label}
      </Label>

      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button type="button" onClick={addItem} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-1 mt-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-center justify-between p-2 bg-muted rounded-md"
            >
              <span className="text-sm">{item}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**File:** `src/components/frameworks/shared/QuadrantLayout.tsx`
```typescript
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface QuadrantLayoutProps {
  topLeft: ReactNode;
  topRight: ReactNode;
  bottomLeft: ReactNode;
  bottomRight: ReactNode;
  className?: string;
}

export function QuadrantLayout({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  className
}: QuadrantLayoutProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
      <div className="p-4 border rounded-lg bg-card">
        {topLeft}
      </div>
      <div className="p-4 border rounded-lg bg-card">
        {topRight}
      </div>
      <div className="p-4 border rounded-lg bg-card">
        {bottomLeft}
      </div>
      <div className="p-4 border rounded-lg bg-card">
        {bottomRight}
      </div>
    </div>
  );
}
```

**Testing:**
- [ ] ListInput adds/removes items correctly
- [ ] Enter key adds items
- [ ] Error messages display
- [ ] QuadrantLayout renders 4 sections responsively

---

### Step 6: SWOT Form Component (Day 2 Afternoon)

**File:** `src/components/frameworks/swot/SwotForm.tsx`
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { swotFormSchema, type SwotFormInput } from '@/lib/schemas/swot.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ListInput } from '../shared/ListInput';
import { QuadrantLayout } from '../shared/QuadrantLayout';
import type { SwotFramework } from '@/types/swot.types';

interface SwotFormProps {
  initialData?: SwotFramework;
  onSubmit: (data: SwotFormInput) => void;
  isLoading?: boolean;
}

export function SwotForm({ initialData, onSubmit, isLoading }: SwotFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SwotFormInput>({
    resolver: zodResolver(swotFormSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      description: initialData.description,
      strengths: initialData.data.strengths,
      weaknesses: initialData.data.weaknesses,
      opportunities: initialData.data.opportunities,
      threats: initialData.data.threats,
    } : {
      name: '',
      description: '',
      strengths: [],
      weaknesses: [],
      opportunities: [],
      threats: [],
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name" className="required">Analysis Name</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="e.g., Company X SWOT Analysis"
          />
          {errors.name && (
            <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Optional description..."
            rows={3}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">SWOT Analysis</h3>
        <QuadrantLayout
          topLeft={
            <ListInput
              label="Strengths"
              items={watch('strengths')}
              onChange={(items) => setValue('strengths', items)}
              placeholder="Add a strength..."
              required
              error={errors.strengths?.message}
            />
          }
          topRight={
            <ListInput
              label="Weaknesses"
              items={watch('weaknesses')}
              onChange={(items) => setValue('weaknesses', items)}
              placeholder="Add a weakness..."
              required
              error={errors.weaknesses?.message}
            />
          }
          bottomLeft={
            <ListInput
              label="Opportunities"
              items={watch('opportunities')}
              onChange={(items) => setValue('opportunities', items)}
              placeholder="Add an opportunity..."
              required
              error={errors.opportunities?.message}
            />
          }
          bottomRight={
            <ListInput
              label="Threats"
              items={watch('threats')}
              onChange={(items) => setValue('threats', items)}
              placeholder="Add a threat..."
              required
              error={errors.threats?.message}
            />
          }
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
```

**Testing:**
- [ ] Form validation works
- [ ] Initial data loads for edit mode
- [ ] Submit calls onSubmit with correct data
- [ ] Cancel button works
- [ ] Loading state disables submit

---

### Step 7: SWOT Pages (Day 3)

**File:** `src/pages/frameworks/SwotListPage.tsx`
```typescript
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useFrameworks } from '@/hooks/useFrameworks';
import { Button } from '@/components/ui/button';
import { FrameworkCard } from '@/components/frameworks/shared/FrameworkCard';
import { Skeleton } from '@/components/ui/skeleton';

export function SwotListPage() {
  const { data: frameworks, isLoading, error } = useFrameworks('swot');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive">
        Error loading SWOT analyses: {error.message}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">SWOT Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Analyze Strengths, Weaknesses, Opportunities, and Threats
          </p>
        </div>
        <Button asChild>
          <Link to="/frameworks/swot/create">
            <Plus className="h-4 w-4 mr-2" />
            New SWOT Analysis
          </Link>
        </Button>
      </div>

      {frameworks && frameworks.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            No SWOT analyses yet. Create your first one!
          </p>
          <Button asChild>
            <Link to="/frameworks/swot/create">
              <Plus className="h-4 w-4 mr-2" />
              Create SWOT Analysis
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {frameworks?.map((framework) => (
            <FrameworkCard
              key={framework.id}
              framework={framework}
              href={`/frameworks/swot/${framework.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**File:** `src/pages/frameworks/SwotCreatePage.tsx`
```typescript
import { SwotForm } from '@/components/frameworks/swot/SwotForm';
import { useCreateFramework } from '@/hooks/useCreateFramework';
import type { SwotFormInput } from '@/lib/schemas/swot.schema';

export function SwotCreatePage() {
  const { mutate: createFramework, isPending } = useCreateFramework();

  const handleSubmit = (formData: SwotFormInput) => {
    createFramework({
      frameworkType: 'swot',
      name: formData.name,
      description: formData.description,
      data: {
        strengths: formData.strengths,
        weaknesses: formData.weaknesses,
        opportunities: formData.opportunities,
        threats: formData.threats,
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create SWOT Analysis</h1>
        <p className="text-muted-foreground mt-1">
          Analyze Strengths, Weaknesses, Opportunities, and Threats
        </p>
      </div>

      <SwotForm onSubmit={handleSubmit} isLoading={isPending} />
    </div>
  );
}
```

**File:** `src/pages/frameworks/SwotViewPage.tsx`
```typescript
import { useParams, Link } from 'react-router-dom';
import { Edit, Trash2, Download } from 'lucide-react';
import { useFramework } from '@/hooks/useFramework';
import { useDeleteFramework } from '@/hooks/useDeleteFramework';
import { Button } from '@/components/ui/button';
import { QuadrantLayout } from '@/components/frameworks/shared/QuadrantLayout';
import { Skeleton } from '@/components/ui/skeleton';
import type { SwotFramework } from '@/types/swot.types';

export function SwotViewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: framework, isLoading, error } = useFramework(id!);
  const { mutate: deleteFramework } = useDeleteFramework();

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (error) {
    return (
      <div className="text-center text-destructive">
        Error loading SWOT analysis: {error.message}
      </div>
    );
  }

  const swot = framework as SwotFramework;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{swot.name}</h1>
          {swot.description && (
            <p className="text-muted-foreground mt-2">{swot.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Created: {new Date(swot.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/frameworks/swot/${id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm('Are you sure you want to delete this SWOT analysis?')) {
                deleteFramework(id!);
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <QuadrantLayout
        topLeft={
          <div>
            <h3 className="font-semibold text-lg mb-3 text-green-600">Strengths</h3>
            <ul className="space-y-2">
              {swot.data.strengths.map((item, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        }
        topRight={
          <div>
            <h3 className="font-semibold text-lg mb-3 text-red-600">Weaknesses</h3>
            <ul className="space-y-2">
              {swot.data.weaknesses.map((item, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        }
        bottomLeft={
          <div>
            <h3 className="font-semibold text-lg mb-3 text-blue-600">Opportunities</h3>
            <ul className="space-y-2">
              {swot.data.opportunities.map((item, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        }
        bottomRight={
          <div>
            <h3 className="font-semibold text-lg mb-3 text-orange-600">Threats</h3>
            <ul className="space-y-2">
              {swot.data.threats.map((item, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        }
      />
    </div>
  );
}
```

**File:** `src/pages/frameworks/SwotEditPage.tsx`
```typescript
import { useParams } from 'react-router-dom';
import { SwotForm } from '@/components/frameworks/swot/SwotForm';
import { useFramework } from '@/hooks/useFramework';
import { useUpdateFramework } from '@/hooks/useUpdateFramework';
import { Skeleton } from '@/components/ui/skeleton';
import type { SwotFramework } from '@/types/swot.types';
import type { SwotFormInput } from '@/lib/schemas/swot.schema';

export function SwotEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: framework, isLoading } = useFramework(id!);
  const { mutate: updateFramework, isPending } = useUpdateFramework();

  const handleSubmit = (formData: SwotFormInput) => {
    updateFramework({
      id: id!,
      data: {
        name: formData.name,
        description: formData.description,
        data: {
          strengths: formData.strengths,
          weaknesses: formData.weaknesses,
          opportunities: formData.opportunities,
          threats: formData.threats,
        },
      },
    });
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit SWOT Analysis</h1>
        <p className="text-muted-foreground mt-1">
          Update your SWOT analysis
        </p>
      </div>

      <SwotForm
        initialData={framework as SwotFramework}
        onSubmit={handleSubmit}
        isLoading={isPending}
      />
    </div>
  );
}
```

**Testing:**
- [ ] List page shows all SWOT analyses
- [ ] Create page creates new SWOT
- [ ] Edit page loads and updates SWOT
- [ ] View page displays SWOT correctly
- [ ] Delete confirmation works
- [ ] Navigation between pages works

---

### Step 8: Update Routes (Day 3)

**File:** `src/routes/index.tsx`
Add SWOT routes:
```typescript
{
  path: 'frameworks/swot',
  children: [
    { index: true, element: <SwotListPage /> },
    { path: 'create', element: <SwotCreatePage /> },
    { path: ':id', element: <SwotViewPage /> },
    { path: ':id/edit', element: <SwotEditPage /> },
  ],
},
```

---

### Step 9: Extend to Other Simple Frameworks (Days 4-7)

Repeat Steps 1-8 for:
- PEST Analysis
- DIME
- Starbursting
- VRIO
- Trend Analysis

**Pattern:**
1. Create types (10 min)
2. Create Zod schema (10 min)
3. Create form component (30-60 min)
4. Create pages (30-60 min)
5. Add routes (5 min)
6. Test (30 min)

**Total per framework:** 2-4 hours

---

## ✅ Testing Checklist

### Unit Tests
- [ ] Zod schemas validate correctly
- [ ] API client handles errors
- [ ] Hooks work with React Query

### Integration Tests
- [ ] Create framework flow works
- [ ] Update framework flow works
- [ ] Delete framework flow works
- [ ] List pagination works (if implemented)
- [ ] Search/filter works (if implemented)

### E2E Tests (Critical Paths)
- [ ] User can create SWOT analysis
- [ ] User can view SWOT analysis
- [ ] User can edit SWOT analysis
- [ ] User can delete SWOT analysis
- [ ] User can navigate between frameworks

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Focus indicators visible
- [ ] Form errors announced

### Performance
- [ ] List page loads < 1s
- [ ] Form submissions < 500ms
- [ ] No unnecessary re-renders
- [ ] Optimistic updates feel instant

---

## 📦 Deliverables

1. **Code:**
   - [ ] All components implemented
   - [ ] All hooks implemented
   - [ ] All pages implemented
   - [ ] Routes configured
   - [ ] TypeScript types complete

2. **Documentation:**
   - [ ] Component usage documented
   - [ ] API client documented
   - [ ] Framework patterns documented

3. **Tests:**
   - [ ] Unit tests passing
   - [ ] Integration tests passing
   - [ ] E2E tests passing

4. **Deployment:**
   - [ ] Works in local dev
   - [ ] Works with Wrangler dev
   - [ ] Deployed to Cloudflare Pages

---

## 🚨 Common Issues & Solutions

### Issue: Form doesn't submit
**Solution:** Check React Hook Form validation, console errors, and network tab

### Issue: Data doesn't persist
**Solution:** Verify D1 database connection, check Cloudflare Functions logs

### Issue: List doesn't update after create
**Solution:** Ensure `queryClient.invalidateQueries` is called in mutation

### Issue: TypeScript errors
**Solution:** Ensure types are imported correctly, check for any/unknown types

### Issue: Styling looks wrong
**Solution:** Check Tailwind CSS config, ensure classes are correct

---

## 📚 Resources

- [React Hook Form Docs](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Radix UI Components](https://www.radix-ui.com/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)

---

**Phase Status:** Ready to Start
**Next Phase:** Phase 3 - Complex Frameworks
**Estimated Completion:** 1-2 weeks
