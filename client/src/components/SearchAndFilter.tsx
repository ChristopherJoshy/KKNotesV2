import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { firebaseService } from "@/lib/firebaseAdmin";
import type { Scheme } from "@shared/schema";

export interface SearchFilters {
  query: string;
  scheme: string;
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
  const [schemes, setSchemes] = React.useState<Scheme[]>([]);
  const [loadingSchemes, setLoadingSchemes] = React.useState(false);

  // Load schemes on mount
  React.useEffect(() => {
    const loadSchemes = async () => {
      setLoadingSchemes(true);
      try {
        const schemeList = await firebaseService.getSchemes();
        setSchemes(schemeList);
      } catch (error) {
        console.error('Error loading schemes:', error);
      } finally {
        setLoadingSchemes(false);
      }
    };
    loadSchemes();
  }, []);

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
    if (filters.scheme && filters.scheme !== "2019") count++;
    if (filters.semester !== "all") count++;
    if (filters.subject !== "all") count++;
    if (filters.contentType !== "all") count++;
    if (filters.query.trim() !== "") count++;
    return count;
  };

  /**
   * Handle search input with debouncing
   */
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const handleSearchChange = React.useCallback((value: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateFilter('query', value);
    }, 300);
  }, []);
  
  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const hasActiveFilters = getActiveFilterCount() > 0;

  return (
    <Card className="shadow-sm border-border">
      <CardContent className="p-4 sm:p-6">
        {/* Search Input */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-search text-muted-foreground text-sm"></i>
          </div>
          <Input
            data-testid="input-search-query"
            type="text"
            placeholder="Search notes and videos..."
            defaultValue={filters.query}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 sm:pl-10 pr-4 h-10 sm:h-12 text-sm sm:text-base"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
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
            className="h-8 sm:h-9 text-xs sm:text-sm gap-1.5"
          >
            <i className="fas fa-file-pdf"></i>
            Notes
          </Button>
          <Button
            data-testid="button-filter-videos"
            onClick={() => updateFilter('contentType', filters.contentType === 'videos' ? 'all' : 'videos')}
            variant={filters.contentType === 'videos' ? "default" : "outline"}
            size="sm"
            className="h-8 sm:h-9 text-xs sm:text-sm gap-1.5"
          >
            <i className="fas fa-play-circle"></i>
            Videos
          </Button>
        </div>

        {/* Advanced Filters Toggle */}
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CollapsibleTrigger asChild>
              <Button data-testid="button-toggle-filters" variant="ghost" size="sm" className="h-8 text-xs sm:text-sm px-2 sm:px-3">
                <i className="fas fa-filter mr-1.5"></i>
                <span className="hidden xs:inline">Advanced </span>Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 flex items-center justify-center text-[10px]">
                    {getActiveFilterCount()}
                  </Badge>
                )}
                <i className={`fas fa-chevron-${isFiltersOpen ? 'up' : 'down'} ml-1.5 text-xs`}></i>
              </Button>
            </CollapsibleTrigger>
            
            {hasActiveFilters && (
              <Button
                data-testid="button-clear-filters"
                onClick={onClearFilters}
                variant="outline"
                size="sm"
                className="h-8 text-xs sm:text-sm"
              >
                Clear All
              </Button>
            )}
          </div>

          <CollapsibleContent className="space-y-3 sm:space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Scheme Filter */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Scheme</label>
                <Select 
                  value={filters.scheme || "2019"} 
                  onValueChange={(value) => updateFilter('scheme', value)}
                  disabled={loadingSchemes}
                >
                  <SelectTrigger data-testid="select-filter-scheme" className="h-9 sm:h-10 text-sm">
                    <SelectValue placeholder={loadingSchemes ? "Loading..." : "Select scheme"} />
                  </SelectTrigger>
                  <SelectContent>
                    {schemes.map(scheme => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        {scheme.year} Scheme
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Semester Filter */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Semester</label>
                <Select value={filters.semester} onValueChange={(value) => updateFilter('semester', value)}>
                  <SelectTrigger data-testid="select-filter-semester" className="h-9 sm:h-10 text-sm">
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
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Subject</label>
                <Select value={filters.subject} onValueChange={(value) => updateFilter('subject', value)}>
                  <SelectTrigger data-testid="select-filter-subject" className="h-9 sm:h-10 text-sm">
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

              {/* Sort Options */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-xs sm:text-sm font-medium mb-1.5">Sort By</label>
                <div className="flex gap-2">
                  <Select value={filters.sortBy} onValueChange={(value: any) => updateFilter('sortBy', value)}>
                    <SelectTrigger data-testid="select-sort-by" className="flex-1 h-9 sm:h-10 text-sm">
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
                    className="h-9 sm:h-10 w-9 sm:w-10 p-0"
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-muted-foreground">
              <span data-testid="text-results-count">
                {isSearching ? "Searching..." : `${resultsCount} result${resultsCount !== 1 ? 's' : ''} found`}
              </span>
              {filters.query && (
                <span className="truncate max-w-[200px]">
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