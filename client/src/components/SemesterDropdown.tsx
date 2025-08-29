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
      <label className="block text-sm font-medium text-card-foreground mb-2">Semester</label>
      <Button
        data-testid="dropdown-semester"
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        className="w-full justify-between bg-input border-border hover:bg-input/80 text-left"
      >
        <span data-testid="text-semester-selected" className={cn(
          selectedOption ? "text-foreground" : "text-muted-foreground"
        )}>
          {selectedOption ? selectedOption.label : "Select Semester"}
        </span>
        <i className={cn(
          "fas fa-chevron-down text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )}></i>
      </Button>
      
      <div className={cn(
        "absolute top-full left-0 right-0 bg-popover border border-border rounded-lg mt-1 shadow-lg z-50 transition-all duration-200 transform-gpu",
        isOpen ? "opacity-100 scale-y-100 visible" : "opacity-0 scale-y-0 invisible"
      )}>
        <div className="py-2">
          {SEMESTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              data-testid={`option-semester-${option.value}`}
              onClick={() => {
                onSemesterSelect(option.value);
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <div className="flex justify-between items-center">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.year}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
