import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface SearchFilters {
  query: string;
  semester: string;
  subject: string;
  contentType: "all" | "notes" | "videos";
  sortBy: "relevance" | "date" | "downloads" | "title";
  sortOrder: "asc" | "desc";
}

interface SearchAndFilterProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  availableSubjects: Record<string, { name: string }>;
  resultsCount?: number;
  isSearching?: boolean;
  onClearFilters: () => void;
}

const SEMESTER_OPTIONS = [
  { value: "all", label: "All Semesters" },
  { value: "s1", label: "Semester 1" },
  { value: "s2", label: "Semester 2" },
  { value: "s3", label: "Semester 3" },
  { value: "s4", label: "Semester 4" },
  { value: "s5", label: "Semester 5" },
  { value: "s6", label: "Semester 6" },
  { value: "s7", label: "Semester 7" },
  { value: "s8", label: "Semester 8" },
];

// Date range filter removed per requirements

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "date", label: "Date Added" },
  { value: "downloads", label: "Popularity" },
  { value: "title", label: "Title" },
];

/**
 * Advanced search and filtering component for notes and videos
 * Provides comprehensive search functionality with multiple filter options
 */
export function SearchAndFilter({
  filters,
  onFiltersChange,
  availableSubjects,
  resultsCount = 0,
  isSearching = false,
  onClearFilters
}: SearchAndFilterProps) {
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);

  /**
   * Update individual filter values
   */
  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  /**
   * Get active filter count for badge display
   */
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.semester !== "all") count++;
    if (filters.subject !== "all") count++;
    if (filters.contentType !== "all") count++;
    if (filters.query.trim() !== "") count++;
    return count;
  };

  /**
   * Handle search input with debouncing
   */
  const handleSearchChange = React.useCallback(
    React.useMemo(
      () => {
        let timeoutId: NodeJS.Timeout;
        return (value: string) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            updateFilter('query', value);
          }, 300);
        };
      },
      [filters]
    ),
    [filters]
  );

  const hasActiveFilters = getActiveFilterCount() > 0;

  return (
    <Card className="mb-6 shadow-sm">
      <CardContent className="pt-6">
        {/* Search Input */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-search text-muted-foreground"></i>
          </div>
          <Input
            data-testid="input-search-query"
            type="text"
            placeholder="Search notes and videos..."
            defaultValue={filters.query}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-4 h-12 text-base"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            </div>
          )}
        </div>

        {/* Quick Filter Buttons */}
  <div className="flex flex-wrap gap-2 mb-4">
          <Button
            data-testid="button-filter-notes"
            onClick={() => updateFilter('contentType', filters.contentType === 'notes' ? 'all' : 'notes')}
            variant={filters.contentType === 'notes' ? "default" : "outline"}
            size="sm"
          >
            <i className="fas fa-file-pdf mr-2"></i>
            Notes
          </Button>
          <Button
            data-testid="button-filter-videos"
            onClick={() => updateFilter('contentType', filters.contentType === 'videos' ? 'all' : 'videos')}
            variant={filters.contentType === 'videos' ? "default" : "outline"}
            size="sm"
          >
            <i className="fas fa-play-circle mr-2"></i>
            Videos
          </Button>
        </div>

        {/* Advanced Filters Toggle */}
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button data-testid="button-toggle-filters" variant="ghost" size="sm">
                <i className="fas fa-filter mr-2"></i>
                Advanced Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">
                    {getActiveFilterCount()}
                  </Badge>
                )}
                <i className={`fas fa-chevron-${isFiltersOpen ? 'up' : 'down'} ml-2`}></i>
              </Button>
            </CollapsibleTrigger>
            
            {hasActiveFilters && (
              <Button
                data-testid="button-clear-filters"
                onClick={onClearFilters}
                variant="outline"
                size="sm"
              >
                Clear All
              </Button>
            )}
          </div>

          <CollapsibleContent className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Semester Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Semester</label>
                <Select value={filters.semester} onValueChange={(value) => updateFilter('semester', value)}>
                  <SelectTrigger data-testid="select-filter-semester">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTER_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Subject</label>
                <Select value={filters.subject} onValueChange={(value) => updateFilter('subject', value)}>
                  <SelectTrigger data-testid="select-filter-subject">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {Object.entries(availableSubjects).map(([id, subject]) => (
                      <SelectItem key={id} value={id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range filter removed */}

              {/* Sort Options */}
              <div>
                <label className="block text-sm font-medium mb-2">Sort By</label>
                <div className="flex space-x-2">
                  <Select value={filters.sortBy} onValueChange={(value: any) => updateFilter('sortBy', value)} >
                    <SelectTrigger data-testid="select-sort-by" className="flex-1">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    data-testid="button-sort-order"
                    onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                    variant="outline"
                    size="sm"
                  >
                    <i className={`fas fa-sort-${filters.sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Results Summary */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span data-testid="text-results-count">
                {isSearching ? "Searching..." : `${resultsCount} result${resultsCount !== 1 ? 's' : ''} found`}
              </span>
              {filters.query && (
                <span>
                  for "{filters.query}"
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}