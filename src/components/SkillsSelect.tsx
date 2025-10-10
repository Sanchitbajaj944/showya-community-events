import React, { useState, useMemo } from "react";
import { X, Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SKILLS = [
  "Singer", "Pianist", "Guitarist", "Drummer", "Violinist", "Cellist", "Harpist", "Banjoist",
  "Ukulele Player", "Clarinetist", "Flutist", "Saxophonist", "Trumpeter", "Trombonist",
  "French Horn Player", "Bagpiper", "Organist", "Sitar Player", "Tabla player", "Xylophonist",
  "Accordionist", "Synthesizer Player", "Harmonicist", "Bass Guitarist", "DJ", "Music Producer",
  "Sound Engineer", "Audio Engineer", "Music Composer", "Arranger", "Music Director",
  "Sound Editor", "Live Sound Technician", "Actor", "Director", "Producer", "Screenwriter",
  "Cinematographer", "Film Editor", "Sound Designer", "Visual Effects Artist", "Lighting Designer",
  "Voiceover Artist", "Casting Director", "Art Director", "Theatre Director", "Dramaturg",
  "Stage Manager", "Technical Director", "Prop Master", "Gaffer", "Storyboard Artist",
  "Foley Artist", "Stunt Performer", "Set Designer", "Video Editor", "Videographer",
  "Painter", "Sculptor", "Graffiti Artist", "Poster Artist", "Body Artist", "Conceptual Artist",
  "Ceramics Artist", "Mosaic Artist", "Tattoo Artist", "Stained Glass Artist", "Digital Artist",
  "Illustrator", "Muralist", "Mixed Media Artist", "Abstract Artist", "Performance Artist",
  "Textile Artist", "Gallery Curator", "Wedding Photographer", "Portrait Photographer",
  "Wildlife Photographer", "Event Photographer", "Fashion Photographer", "Architectural Photographer",
  "Travel Photographer", "Sports Photographer", "Astrophotographer", "Fine Art Photographer",
  "Food Photographer", "Product Photographer", "Self-Portrait Photographer", "Ballet Dancer",
  "Contemporary Dancer", "Hip-hop Dancer", "Freestyle Dancer", "Jazz Dancer", "Breakdancer",
  "Ballroom Dancer", "Salsa Dancer", "Swing Dancer", "Indian Classical Dancer", "Tap Dancer",
  "Folk Dancer", "Modern Dancer", "Tango Dancer", "Choreographer", "Belly Dancer", "Pole Dancer",
  "Fashion Designer", "Accessory Designer", "Model", "Hairdresser", "Makeup Artist", "Nail Artist",
  "Stylist", "Printmaker", "Fashion Stylist", "Textile Designer", "Fashion Illustrator",
  "Footwear Designer", "Costume Designer", "Fashion Writer", "Poet", "Novelist", "Blogger",
  "Screenwriter", "Playwright", "Lyricist", "Copywriter", "Speech Writer", "Article writer",
  "Biographer", "Editor", "Vlogger", "Podcaster", "Comedian", "influencer", "Graphic Designer",
  "Illustrator", "Calligrapher", "Typographer", "Web Designer", "Interior Designer",
  "Product Designer", "UI/UX Designer", "Architect", "Game Designer", "2D Animator",
  "3D Animator", "Motion Graphics Animator", "Stop Motion Animator"
];

interface SkillsSelectProps {
  value: string[];
  onChange: (skills: string[]) => void;
  disabled?: boolean;
}

export function SkillsSelect({ value, onChange, disabled }: SkillsSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSkills = useMemo(() => {
    return SKILLS.filter(
      (skill) =>
        skill.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !value.includes(skill)
    );
  }, [searchQuery, value]);

  const handleSelect = (skill: string) => {
    if (!value.includes(skill)) {
      onChange([...value, skill]);
    }
    setSearchQuery("");
  };

  const handleRemove = (skillToRemove: string) => {
    onChange(value.filter((skill) => skill !== skillToRemove));
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              {value.length === 0 ? "Select skills..." : `${value.length} skill${value.length === 1 ? '' : 's'} selected`}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search skills..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No skills found.</CommandEmpty>
              <CommandGroup>
                {filteredSkills.map((skill) => (
                  <CommandItem
                    key={skill}
                    value={skill}
                    onSelect={() => handleSelect(skill)}
                  >
                    {skill}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((skill) => (
            <Badge
              key={skill}
              variant="secondary"
              className="pl-3 pr-1 py-1 gap-1"
            >
              {skill}
              <button
                type="button"
                onClick={() => handleRemove(skill)}
                disabled={disabled}
                className={cn(
                  "ml-1 rounded-sm hover:bg-muted p-0.5",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}