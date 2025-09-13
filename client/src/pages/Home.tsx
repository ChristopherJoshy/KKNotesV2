import * as React from "react";
import { Layout } from "@/components/Layout";
import { SemesterDropdown } from "@/components/SemesterDropdown";
import { SubjectDropdown } from "@/components/SubjectDropdown";
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
    // Initialize Firebase subjects and load all subjects for search
    firebaseService.initializeSubjects();
    loadAllSubjectsForSearch();
  }, []);

  /**
   * Load all subjects across all semesters for search filtering
   */
  const loadAllSubjectsForSearch = async () => {
    try {
      const subjects = await firebaseService.getAllSubjects();
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
      const semesterSubjects = await firebaseService.getSubjects(semester);
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
  }, []);

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
        sortOrder: filters.sortOrder
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
        <>
          {/* Header Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Welcome to KKNotes V2
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Search and browse course materials with advanced filtering. Access notes and videos organized by semester and subject.
            </p>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={currentView} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search" className="flex items-center">
                <i className="fas fa-search mr-2"></i>
                Search & Filter
              </TabsTrigger>
              <TabsTrigger value="browse" className="flex items-center">
                <i className="fas fa-folder mr-2"></i>
                Browse by Subject
              </TabsTrigger>
            </TabsList>

            {/* Search Tab Content */}
            <TabsContent value="search" className="space-y-6">
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
            <TabsContent value="browse" className="space-y-6">
              {/* Navigation Section */}
              <Card className="shadow-sm">
                <CardContent className="pt-6">
                  <h3 className="text-xl font-semibold text-card-foreground mb-6">Select Your Course</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                      <label className="block text-sm font-medium text-card-foreground mb-2">Category</label>
                      <div className="flex space-x-2">
                        <Button
                          data-testid="button-category-all"
                          onClick={() => setSelectedCategory("all")}
                          variant={selectedCategory === "all" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                        >
                          All
                        </Button>
                        <Button
                          data-testid="button-category-notes"
                          onClick={() => setSelectedCategory("notes")}
                          variant={selectedCategory === "notes" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                        >
                          <i className="fas fa-file-pdf mr-1"></i>
                          Notes
                        </Button>
                        <Button
                          data-testid="button-category-videos"
                          onClick={() => setSelectedCategory("videos")}
                          variant={selectedCategory === "videos" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                        >
                          <i className="fas fa-play-circle mr-1"></i>
                          Videos
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
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <EnhancedAdminPanel onClose={toggleAdminPanel} />
      )}
    </Layout>
  );
}
