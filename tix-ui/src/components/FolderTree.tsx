import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useDndState } from '#/lib/DndProvider'
import type { Ticket } from '#/lib/types'
import {
  TreeProvider,
  TreeView,
  TreeNode,
  TreeNodeTrigger,
  TreeNodeContent,
  TreeExpander,
  TreeIcon,
  TreeLabel,
} from '#/components/kibo-ui/tree'

const DEFAULT_IGNORED_FOLDERS = ['archive']

interface FolderNode {
  name: string
  path: string
  count: number
  children: FolderNode[]
  ignored: boolean
}

function buildFolderTree(tickets: Ticket[]): FolderNode[] {
  const folderCounts = new Map<string, number>()
  for (const t of tickets) {
    if (!t.folder) continue
    // Count ticket only in its direct folder
    folderCounts.set(t.folder, (folderCounts.get(t.folder) || 0) + 1)
    // Ensure ancestor folders exist in the tree (with 0 count if they have no direct items)
    const parts = t.folder.split('/')
    for (let i = 1; i < parts.length; i++) {
      const ancestor = parts.slice(0, i).join('/')
      if (!folderCounts.has(ancestor)) folderCounts.set(ancestor, 0)
    }
  }

  // Build tree structure
  const root: FolderNode[] = []
  const nodeMap = new Map<string, FolderNode>()

  const sortedPaths = Array.from(folderCounts.keys()).sort()
  for (const folderPath of sortedPaths) {
    const parts = folderPath.split('/')
    const name = parts[parts.length - 1]!
    const node: FolderNode = {
      name,
      path: folderPath,
      count: folderCounts.get(folderPath) || 0,
      children: [],
      ignored: DEFAULT_IGNORED_FOLDERS.includes(parts[0]!),
    }
    nodeMap.set(folderPath, node)

    if (parts.length === 1) {
      root.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join('/')
      const parent = nodeMap.get(parentPath)
      if (parent) {
        parent.children.push(node)
      } else {
        root.push(node)
      }
    }
  }

  // Sort: non-ignored first, then alphabetical
  const sortNodes = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => {
      if (a.ignored !== b.ignored) return a.ignored ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) sortNodes(n.children)
  }
  sortNodes(root)

  return root
}

interface FolderTreeProps {
  tickets: Ticket[]
  /** Currently selected folder path, or empty string for root. */
  selectedFolder: string
  onSelect: (folder: string) => void
  /** Total ticket count for root label. */
  totalCount: number
}

export function FolderTree({ tickets, selectedFolder, onSelect, totalCount }: FolderTreeProps) {
  const tree = useMemo(() => buildFolderTree(tickets), [tickets])
  const { activeTicket } = useDndState()
  const { setNodeRef: setRootRef, isOver: isRootOver } = useDroppable({ id: 'folder:', disabled: !activeTicket })

  // Always show the tree — root entry is the way back
  const hasSubfolders = tree.length > 0

  // Single-select navigation: clicking a folder goes there, clicking the
  // already-selected folder is a no-op (not a toggle/deselect).
  const selectedIds = selectedFolder ? [selectedFolder] : ['__root__']
  function handleSelectionChange(ids: string[]) {
    // Find the newly clicked id (the one that wasn't previously selected)
    const clicked = ids.find(id => !selectedIds.includes(id))
    if (!clicked) return // Already selected — no-op
    onSelect(clicked === '__root__' ? '' : clicked)
  }

  return (
    <>
      <div className="px-3 mt-4 mb-1">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Folders</span>
      </div>
      <div className="px-0">
        <TreeProvider
          multiSelect={false}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          showLines={false}
          showIcons={true}
          indent={16}
          animateExpand
          defaultExpandedIds={['__root__', ...tree.filter(n => n.children.length > 0).map(n => n.path)]}
        >
          <TreeView className="p-0">
            <TreeNode nodeId="__root__" level={0} isLast={!hasSubfolders}>
              <TreeNodeTrigger ref={setRootRef} className={`py-1 px-2 mx-0 rounded-md ${isRootOver ? 'ring-2 ring-ring bg-accent/30' : ''}`}>
                <TreeExpander hasChildren={hasSubfolders} />
                <TreeIcon hasChildren={true} />
                <TreeLabel className="text-sm font-medium">tickets</TreeLabel>
                <span className="ml-auto text-xs text-muted-foreground">{totalCount}</span>
              </TreeNodeTrigger>
              {hasSubfolders && (
                <TreeNodeContent hasChildren>
                  {tree.map((node, i) => (
                    <FolderNodeItem key={node.path} node={node} level={1} isLast={i === tree.length - 1} />
                  ))}
                </TreeNodeContent>
              )}
            </TreeNode>
          </TreeView>
        </TreeProvider>
      </div>
    </>
  )
}

function FolderNodeItem({ node, level, isLast }: { node: FolderNode; level: number; isLast: boolean }) {
  const hasChildren = node.children.length > 0
  const { activeTicket } = useDndState()
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${node.path}`, disabled: !activeTicket })

  return (
    <TreeNode nodeId={node.path} level={level} isLast={isLast}>
      <TreeNodeTrigger
        ref={setNodeRef}
        className={`py-1 px-2 mx-0 rounded-md ${node.ignored ? 'opacity-50' : ''} ${isOver ? 'ring-2 ring-ring bg-accent/30' : ''}`}
      >
        <TreeExpander hasChildren={hasChildren} />
        <TreeIcon hasChildren={hasChildren} />
        <TreeLabel className="text-sm">{node.name}</TreeLabel>
        <span className="ml-auto text-xs text-muted-foreground">{node.count}</span>
      </TreeNodeTrigger>
      {hasChildren && (
        <TreeNodeContent hasChildren>
          {node.children.map((child, i) => (
            <FolderNodeItem key={child.path} node={child} level={level + 1} isLast={i === node.children.length - 1} />
          ))}
        </TreeNodeContent>
      )}
    </TreeNode>
  )
}
