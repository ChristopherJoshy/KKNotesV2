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

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-card-foreground mb-2">Subject</label>
      <Button
        data-testid="dropdown-subject"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        variant="outline"
        disabled={disabled}
        className="w-full justify-between bg-input border-border hover:bg-input/80 text-left disabled:opacity-50"
      >
        <span data-testid="text-subject-selected" className={cn(
          selectedSubjectData ? "text-foreground" : "text-muted-foreground"
        )}>
          {selectedSubjectData ? selectedSubjectData.name : disabled ? "Select semester first" : "Select Subject"}
        </span>
        <i className={cn(
          "fas fa-chevron-down text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )}></i>
      </Button>
      
      {!disabled && (
        <div className={cn(
          "absolute top-full left-0 right-0 bg-popover border border-border rounded-lg mt-1 shadow-lg z-40 transition-all duration-200 transform-gpu max-h-64 overflow-y-auto",
          isOpen ? "opacity-100 scale-y-100 visible" : "opacity-0 scale-y-0 invisible"
        )}>
          <div className="py-2">
            {Object.entries(subjects).map(([subjectId, subject]) => (
              <button
                key={subjectId}
                data-testid={`option-subject-${subjectId}`}
                onClick={() => {
                  onSubjectSelect(subjectId);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border last:border-b-0"
              >
                <div className="font-medium text-sm">{subject.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
