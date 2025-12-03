import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { firebaseService } from "@/lib/firebaseAdmin";
import type { Scheme } from "@shared/schema";

interface SchemeDropdownProps {
  selectedScheme: string;
  onSchemeSelect: (schemeId: string) => void;
}

export function SchemeDropdown({ selectedScheme, onSchemeSelect }: SchemeDropdownProps) {
  const [schemes, setSchemes] = React.useState<Scheme[]>([]);
  const [loading, setLoading] = React.useState(true);

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

  const handleSchemeChange = (schemeId: string) => {
    firebaseService.setCurrentScheme(schemeId);
    onSchemeSelect(schemeId);
  };

  return (
    <div>
      <label className="block text-xs sm:text-sm font-medium text-card-foreground mb-1.5 sm:mb-2">
        Scheme
      </label>
      <Select value={selectedScheme} onValueChange={handleSchemeChange} disabled={loading}>
        <SelectTrigger className="h-9 sm:h-10 text-sm">
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
    </div>
  );
}
