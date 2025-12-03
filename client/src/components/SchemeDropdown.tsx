import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { firebaseService } from "@/lib/firebaseAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { Scheme } from "@shared/schema";

interface SchemeDropdownProps {
  selectedScheme: string;
  onSchemeSelect: (schemeId: string) => void;
}

export function SchemeDropdown({ selectedScheme, onSchemeSelect }: SchemeDropdownProps) {
  const { isAdmin } = useAuth();
  const [schemes, setSchemes] = React.useState<Scheme[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newSchemeYear, setNewSchemeYear] = React.useState("");
  const [newSchemeDescription, setNewSchemeDescription] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    loadSchemes();
  }, []);

  const loadSchemes = async () => {
    setLoading(true);
    try {
      const schemeList = await firebaseService.getSchemes();
      setSchemes(schemeList);
      
      // If no scheme is selected, select the default one
      if (!selectedScheme && schemeList.length > 0) {
        const defaultScheme = schemeList.find(s => s.isDefault) || schemeList[0];
        onSchemeSelect(defaultScheme.id);
      }
    } catch (error) {
      console.error('Error loading schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScheme = async () => {
    const year = parseInt(newSchemeYear);
    if (!year || year < 2000 || year > 2100) {
      toast({
        title: "Invalid Year",
        description: "Please enter a valid year between 2000 and 2100.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      await firebaseService.createScheme({
        name: `${year} Scheme`,
        year,
        description: newSchemeDescription || `KTU ${year} Curriculum`,
        isDefault: false,
      });
      
      toast({
        title: "Scheme Created",
        description: `${year} Scheme has been created successfully.`,
      });
      
      setNewSchemeYear("");
      setNewSchemeDescription("");
      setIsCreateDialogOpen(false);
      await loadSchemes();
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error?.message || "Failed to create scheme. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSchemeChange = (schemeId: string) => {
    firebaseService.setCurrentScheme(schemeId);
    onSchemeSelect(schemeId);
  };

  return (
    <div>
      <label className="block text-xs sm:text-sm font-medium text-card-foreground mb-1.5 sm:mb-2">
        Scheme
      </label>
      <div className="flex gap-2">
        <Select value={selectedScheme} onValueChange={handleSchemeChange} disabled={loading}>
          <SelectTrigger className="flex-1 h-9 sm:h-10 text-sm">
            <SelectValue placeholder={loading ? "Loading..." : "Select scheme"} />
          </SelectTrigger>
          <SelectContent>
            {schemes.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id}>
                <div className="flex items-center gap-2">
                  <span>{scheme.name}</span>
                  {scheme.isDefault && (
                    <Badge variant="secondary" className="text-[10px] h-4">Default</Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {isAdmin && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 sm:h-10 w-9 sm:w-10 shrink-0">
                <i className="fas fa-plus text-xs"></i>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <i className="fas fa-graduation-cap text-primary"></i>
                  Create New Scheme
                </DialogTitle>
                <DialogDescription>
                  Add a new curriculum scheme. The new scheme will start empty - you'll need to add subjects and content separately.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="scheme-year">Scheme Year *</Label>
                  <Input
                    id="scheme-year"
                    type="number"
                    placeholder="e.g., 2024"
                    value={newSchemeYear}
                    onChange={(e) => setNewSchemeYear(e.target.value)}
                    className="mt-1.5"
                    min={2000}
                    max={2100}
                  />
                </div>
                <div>
                  <Label htmlFor="scheme-description">Description (Optional)</Label>
                  <Input
                    id="scheme-description"
                    placeholder="e.g., KTU 2024 Updated Curriculum"
                    value={newSchemeDescription}
                    onChange={(e) => setNewSchemeDescription(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
              
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateScheme}
                  disabled={creating || !newSchemeYear}
                >
                  {creating ? (
                    <>
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plus mr-2"></i>
                      Create Scheme
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
