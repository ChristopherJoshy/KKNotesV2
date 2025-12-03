import * as React from "react";
import { Layout } from "@/components/Layout";
import { SemesterDropdown } from "@/components/SemesterDropdown";
import { SubjectDropdown } from "@/components/SubjectDropdown";
import { SchemeDropdown } from "@/components/SchemeDropdown";
import { ContentGrid } from "@/components/ContentGrid";
import { EnhancedAdminPanel } from "@/components/EnhancedAdminPanel";
import { SearchAndFilter, SearchFilters } from "@/components/SearchAndFilter";
import { SearchResults } from "@/components/SearchResults";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { firebaseService } from "@/lib/firebaseAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Subject, ContentItem } from "@shared/schema";

export default function Home() {
  const { isAdmin } = useAuth();
  const [selectedScheme, setSelectedScheme] = React.useState<string>("2019");
  const [selectedSemester, setSelectedSemester] = React.useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string | null>(null);
  const [subjects, setSubjects] = React.useState<Record<string, Subject>>({});
  const [showAdminPanel, setShowAdminPanel] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<"all" | "notes" | "videos">("all");
  const [loading, setLoading] = React.useState(false);
  const [currentView, setCurrentView] = React.useState<"browse" | "search">("browse");
  
  // Search state
  const [searchFilters, setSearchFilters] = React.useState<SearchFilters>({
    query: "",
    scheme: "2019",
    semester: "all",
    subject: "all", 
    contentType: "all",
    sortBy: "relevance",
    sortOrder: "desc"
  });
  const [searchResults, setSearchResults] = React.useState<ContentItem[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [allSubjects, setAllSubjects] = React.useState<Record<string, { name: string; semester: string }>>({});

  React.useEffect(() => {
    // Load current scheme and initialize
    const initializeApp = async () => {
      try {
        const currentScheme = await firebaseService.getCurrentScheme();
        setSelectedScheme(currentScheme);
        // Sync search filters with the loaded scheme
        setSearchFilters(prev => ({ ...prev, scheme: currentScheme }));
      } catch (error) {
        console.error('Error loading current scheme:', error);
      }
      // Initialize Firebase subjects and load all subjects for search
      firebaseService.initializeSubjects();
      loadAllSubjectsForSearch();
    };
    
    initializeApp();
  }, []);

  /**
   * Handle scheme selection change
   */
  const handleSchemeChange = async (scheme: string) => {
    setSelectedScheme(scheme);
    // Reset selections when scheme changes
    setSelectedSemester(null);
    setSelectedSubjectId(null);
    setSubjects({});
    // Save scheme preference
    try {
      await firebaseService.setCurrentScheme(scheme);
    } catch (error) {
      console.error('Error setting current scheme:', error);
    }
    // Reload subjects for search with new scheme
    loadAllSubjectsForSearch();
  };

  /**
   * Load all subjects across all semesters for search filtering
   */
  const loadAllSubjectsForSearch = async () => {
    try {
      const subjects = await firebaseService.getAllSubjects(selectedScheme);
      setAllSubjects(subjects);
    } catch (error) {
      console.error('Error loading subjects for search:', error);
    }
  };

  const handleSemesterSelect = async (semester: string) => {
    setLoading(true);
    setSelectedSemester(semester);
    setSelectedSubjectId(null);
    
    try {
      const semesterSubjects = await firebaseService.getSubjects(semester, selectedScheme);
      setSubjects(semesterSubjects);
    } catch (error) {
      console.error('Error loading subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectSelect = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
  };

  const toggleAdminPanel = () => {
    setShowAdminPanel(!showAdminPanel);
  };

  /**
   * Handle search filter changes and perform search
   */
  const handleSearchFiltersChange = React.useCallback(async (newFilters: SearchFilters) => {
    setSearchFilters(newFilters);
    
    // Update selected scheme if changed in search filters
    if (newFilters.scheme && newFilters.scheme !== selectedScheme) {
      setSelectedScheme(newFilters.scheme);
    }
    
    // Switch to search view if there's a query or active filters
    const hasActiveSearch = newFilters.query.trim() || 
                           newFilters.semester !== "all" || 
                           newFilters.subject !== "all" ||
                           newFilters.contentType !== "all";
    
    if (hasActiveSearch) {
      setCurrentView("search");
      await performSearch(newFilters);
    } else {
      setCurrentView("browse");
      setSearchResults([]);
    }
  }, [selectedScheme]);

  /**
   * Perform search with given filters
   */
  const performSearch = async (filters: SearchFilters) => {
    setSearchLoading(true);
    try {
      const results = await firebaseService.searchContent({
        query: filters.query,
        semester: filters.semester === "all" ? undefined : filters.semester,
        subject: filters.subject === "all" ? undefined : filters.subject,
        contentType: filters.contentType,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        scheme: filters.scheme || selectedScheme
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error performing search:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  /**
   * Clear all search filters and return to browse mode
   */
  const handleClearFilters = () => {
    const clearedFilters: SearchFilters = {
      query: "",
      scheme: selectedScheme,
      semester: "all",
      subject: "all",
      contentType: "all",
      sortBy: "relevance",
      sortOrder: "desc"
    };
    
    setSearchFilters(clearedFilters);
    setSearchResults([]);
    setCurrentView("browse");
  };

  /**
   * Handle tab changes between browse and search modes
   */
  const handleTabChange = (value: string) => {
    setCurrentView(value as "browse" | "search");
    if (value === "browse") {
      // Clear search when switching to browse mode
      handleClearFilters();
    }
  };

  const selectedSubject = selectedSubjectId ? subjects[selectedSubjectId] : null;

  return (
    <Layout onAdminToggle={isAdmin ? toggleAdminPanel : undefined} showAdminPanel={showAdminPanel}>
      <LoadingOverlay visible={loading} />
      
      {!showAdminPanel ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Hero Section */}
          <div className="text-center py-4 sm:py-8">
            <h1 className="text-responsive-2xl font-bold text-foreground mb-2 sm:mb-4">
              Welcome to KKNotes
            </h1>
            <p className="text-responsive-base text-muted-foreground max-w-2xl mx-auto px-4">
              Access course materials, notes, and videos organized by semester and subject.
            </p>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={currentView} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10 sm:h-11">
              <TabsTrigger value="search" className="text-xs sm:text-sm gap-1.5 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <i className="fas fa-search text-xs"></i>
                <span>Search</span>
              </TabsTrigger>
              <TabsTrigger value="browse" className="text-xs sm:text-sm gap-1.5 sm:gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <i className="fas fa-folder text-xs"></i>
                <span>Browse</span>
              </TabsTrigger>
            </TabsList>

            {/* Search Tab Content */}
            <TabsContent value="search" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              <SearchAndFilter
                filters={searchFilters}
                onFiltersChange={handleSearchFiltersChange}
                availableSubjects={allSubjects}
                resultsCount={searchResults.length}
                isSearching={searchLoading}
                onClearFilters={handleClearFilters}
              />
              
              <SearchResults
                results={searchResults}
                searchQuery={searchFilters.query}
                loading={searchLoading}
              />
            </TabsContent>

            {/* Browse Tab Content */}
            <TabsContent value="browse" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
              {/* Navigation Section */}
              <Card className="shadow-sm border-border">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-card-foreground mb-4 sm:mb-6">
                    Select Your Course
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
                    <SchemeDropdown
                      selectedScheme={selectedScheme}
                      onSchemeSelect={handleSchemeChange}
                    />
                    
                    <SemesterDropdown
                      selectedSemester={selectedSemester}
                      onSemesterSelect={handleSemesterSelect}
                    />
                    
                    <SubjectDropdown
                      subjects={subjects}
                      selectedSubject={selectedSubjectId}
                      onSubjectSelect={handleSubjectSelect}
                      disabled={!selectedSemester}
                    />

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-card-foreground mb-1.5 sm:mb-2">
                        Category
                      </label>
                      <div className="flex gap-1.5 sm:gap-2">
                        <Button
                          data-testid="button-category-all"
                          onClick={() => setSelectedCategory("all")}
                          variant={selectedCategory === "all" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
                        >
                          All
                        </Button>
                        <Button
                          data-testid="button-category-notes"
                          onClick={() => setSelectedCategory("notes")}
                          variant={selectedCategory === "notes" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 text-xs sm:text-sm h-9 sm:h-10 gap-1"
                        >
                          <i className="fas fa-file-pdf text-xs"></i>
                          <span className="hidden xs:inline">Notes</span>
                        </Button>
                        <Button
                          data-testid="button-category-videos"
                          onClick={() => setSelectedCategory("videos")}
                          variant={selectedCategory === "videos" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 text-xs sm:text-sm h-9 sm:h-10 gap-1"
                        >
                          <i className="fas fa-play-circle text-xs"></i>
                          <span className="hidden xs:inline">Videos</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Content Grid */}
              {selectedSemester && selectedSubjectId && selectedSubject && (
                <ContentGrid
                  semester={selectedSemester}
                  subjectId={selectedSubjectId}
                  subject={selectedSubject}
                  selectedCategory={selectedCategory}
                  scheme={selectedScheme}
                />
              )}
              
              {/* Empty state when no selection */}
              {!selectedSemester && (
                <Card className="text-center py-8 sm:py-12 border-dashed">
                  <CardContent>
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <i className="fas fa-book-open text-muted-foreground text-xl sm:text-2xl"></i>
                    </div>
                    <h4 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                      Select a Semester
                    </h4>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Choose a semester above to view available subjects and course materials.
                    </p>
                  </CardContent>
                </Card>
              )}
              
              {selectedSemester && !selectedSubjectId && (
                <Card className="text-center py-8 sm:py-12 border-dashed">
                  <CardContent>
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <i className="fas fa-list text-muted-foreground text-xl sm:text-2xl"></i>
                    </div>
                    <h4 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                      Select a Subject
                    </h4>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Choose a subject to browse notes and video resources.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <EnhancedAdminPanel onClose={toggleAdminPanel} />
      )}
    </Layout>
  );
}
