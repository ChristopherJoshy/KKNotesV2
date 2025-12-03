import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Subject } from "@shared/schema";

interface SubjectDropdownProps {
  subjects: Record<string, Subject>;
  selectedSubject: string | null;
  onSubjectSelect: (subjectId: string) => void;
  disabled?: boolean;
}

export function SubjectDropdown({ 
  subjects, 
  selectedSubject, 
  onSubjectSelect, 
  disabled = false 
}: SubjectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSubjectData = selectedSubject ? subjects[selectedSubject] : null;
  const subjectEntries = Object.entries(subjects);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs sm:text-sm font-medium text-card-foreground mb-1.5 sm:mb-2">Subject</label>
      <Button
        data-testid="dropdown-subject"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        variant="outline"
        disabled={disabled}
        className="w-full justify-between bg-input border-border hover:bg-input/80 text-left disabled:opacity-50 h-10 sm:h-11 text-sm"
      >
        <span data-testid="text-subject-selected" className={cn(
          "truncate",
          selectedSubjectData ? "text-foreground" : "text-muted-foreground"
        )}>
          {selectedSubjectData ? selectedSubjectData.name : disabled ? "Select semester first" : "Select Subject"}
        </span>
        <i className={cn(
          "fas fa-chevron-down text-muted-foreground text-xs ml-2 shrink-0",
          isOpen && "rotate-180"
        )}></i>
      </Button>
      
      {!disabled && (
        <div className={cn(
          "absolute top-full left-0 right-0 bg-popover border border-border rounded-lg mt-1 shadow-lg z-40 max-h-64 overflow-y-auto scrollbar-thin",
          isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        )}>
          <div className="py-1 sm:py-2">
            {subjectEntries.length === 0 ? (
              <div className="px-3 sm:px-4 py-3 text-sm text-muted-foreground text-center">
                No subjects available
              </div>
            ) : (
              subjectEntries.map(([subjectId, subject]) => (
                <button
                  key={subjectId}
                  data-testid={`option-subject-${subjectId}`}
                  onClick={() => {
                    onSubjectSelect(subjectId);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-accent hover:text-accent-foreground border-b border-border last:border-b-0",
                    selectedSubject === subjectId && "bg-accent/50"
                  )}
                >
                  <div className="font-medium text-sm truncate">{subject.name}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
