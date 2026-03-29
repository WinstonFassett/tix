import { describe, it, expect } from 'vitest'
import { markdownToHtml } from '../markdown'

describe('markdownToHtml', () => {
  it('renders headers', () => {
    expect(markdownToHtml('# Hello')).toContain('<h1')
    expect(markdownToHtml('## Sub')).toContain('<h2')
    expect(markdownToHtml('### Third')).toContain('<h3')
  })

  it('renders bold and italic', () => {
    const html = markdownToHtml('**bold** and *italic*')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('renders code blocks', () => {
    const md = '```bash\necho hello\n```'
    const html = markdownToHtml(md)
    expect(html).toContain('<code')
    expect(html).toContain('echo hello')
  })

  it('renders inline code', () => {
    const html = markdownToHtml('use `tix create` to start')
    expect(html).toContain('<code>tix create</code>')
  })

  it('renders unordered lists', () => {
    const md = '- item one\n- item two\n- item three'
    const html = markdownToHtml(md)
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>item one</li>')
    expect(html).toContain('<li>item two</li>')
    expect(html).toContain('<li>item three</li>')
  })

  it('renders nested lists', () => {
    const md = '- parent\n  - child\n  - child2'
    const html = markdownToHtml(md)
    expect(html).toContain('<ul>')
    expect(html).toContain('child')
  })

  it('renders links', () => {
    const html = markdownToHtml('[click](http://example.com)')
    expect(html).toContain('<a href="http://example.com"')
    expect(html).toContain('click</a>')
  })

  it('renders checkboxes (GFM)', () => {
    const md = '- [x] done\n- [ ] todo'
    const html = markdownToHtml(md)
    expect(html).toContain('done')
    expect(html).toContain('todo')
  })
})
