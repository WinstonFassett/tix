import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '#/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '#/components/ui/command'
import { cn } from '#/lib/utils'

interface TicketTagsFieldProps {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  placeholder?: string
  className?: string
}

// Replacement for emblor's TagInput. Built on shadcn Popover + cmdk Command
// (Kibo UI Tags shape, but without Kibo's wrappers — we want a compact inline
// trigger with existing tags visible, not a separate "Select a tag..." button).
// Supports free-form creation and autocomplete from the provided suggestion
// pool. Click the chip body to open the popover, click the × to remove.
export function TicketTagsField({
  value,
  onChange,
  suggestions,
  placeholder = 'Add a tag...',
  className,
}: TicketTagsFieldProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const trimmed = search.trim()
  const available = useMemo(
    () => suggestions.filter(s => !value.includes(s)),
    [suggestions, value],
  )
  const canCreate =
    trimmed.length > 0 &&
    !value.includes(trimmed) &&
    !suggestions.includes(trimmed)

  function addTag(tag: string) {
    const t = tag.trim()
    if (!t) return
    if (value.includes(t)) return
    onChange([...value, t])
    setSearch('')
  }

  function removeTag(tag: string) {
    onChange(value.filter(t => t !== tag))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex w-full flex-wrap items-center gap-1 rounded-md p-1 min-h-8 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
        >
          {value.length === 0 && (
            <span className="px-1.5 text-muted-foreground">{placeholder}</span>
          )}
          {value.map(tag => (
            <span
              key={tag}
              className="inline-flex h-6 items-center gap-1 rounded-md bg-secondary px-2 text-xs text-secondary-foreground"
            >
              {tag}
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Remove ${tag}`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                onClick={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  removeTag(tag)
                }}
                onPointerDown={e => e.stopPropagation()}
              >
                <X className="h-3 w-3" />
              </span>
            </span>
          ))}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[260px] p-0"
      >
        <Command>
          <CommandInput
            placeholder="Search or create tag..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{canCreate ? null : 'No tags found.'}</CommandEmpty>
            {(available.length > 0 || canCreate) && (
              <CommandGroup>
                {available.map(s => (
                  <CommandItem
                    key={s}
                    value={s}
                    onSelect={() => addTag(s)}
                    className="cursor-pointer"
                  >
                    {s}
                  </CommandItem>
                ))}
                {canCreate && (
                  <CommandItem
                    key={`__create__${trimmed}`}
                    value={`__create__${trimmed}`}
                    onSelect={() => addTag(trimmed)}
                    className="cursor-pointer"
                  >
                    Create <span className="ml-1 font-medium">&ldquo;{trimmed}&rdquo;</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
