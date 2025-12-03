import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SemesterDropdownProps {
  selectedSemester: string | null;
  onSemesterSelect: (semester: string) => void;
}

const SEMESTER_OPTIONS = [
  { value: "s1", label: "Semester 1", year: "First Year" },
  { value: "s2", label: "Semester 2", year: "First Year" },
  { value: "s3", label: "Semester 3", year: "Second Year" },
  { value: "s4", label: "Semester 4", year: "Second Year" },
  { value: "s5", label: "Semester 5", year: "Third Year" },
  { value: "s6", label: "Semester 6", year: "Third Year" },
  { value: "s7", label: "Semester 7", year: "Fourth Year" },
  { value: "s8", label: "Semester 8", year: "Fourth Year" },
];

export function SemesterDropdown({ selectedSemester, onSemesterSelect }: SemesterDropdownProps) {
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

  const selectedOption = selectedSemester 
    ? SEMESTER_OPTIONS.find(opt => opt.value === selectedSemester)
    : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs sm:text-sm font-medium text-card-foreground mb-1.5 sm:mb-2">Semester</label>
      <Button
        data-testid="dropdown-semester"
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="w-full justify-between bg-input border-border hover:bg-input/80 text-left h-10 sm:h-11 text-sm"
      >
        <span data-testid="text-semester-selected" className={cn(
          "truncate",
          selectedOption ? "text-foreground" : "text-muted-foreground"
        )}>
          {selectedOption ? selectedOption.label : "Select Semester"}
        </span>
        <i className={cn(
          "fas fa-chevron-down text-muted-foreground text-xs ml-2 shrink-0",
          isOpen && "rotate-180"
        )}></i>
      </Button>
      
      <div className={cn(
        "absolute top-full left-0 right-0 bg-popover border border-border rounded-lg mt-1 shadow-lg z-50",
        isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
      )}>
        <div className="py-1 sm:py-2 max-h-[280px] overflow-y-auto scrollbar-thin">
          {SEMESTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              data-testid={`option-semester-${option.value}`}
              onClick={() => {
                onSemesterSelect(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-accent hover:text-accent-foreground",
                selectedSemester === option.value && "bg-accent/50"
              )}
            >
              <div className="flex justify-between items-center gap-2">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">{option.year}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
