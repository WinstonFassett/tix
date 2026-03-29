import { marked } from 'marked'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function markdownToHtml(md: string): string {
  return marked.parse(md) as string
}
