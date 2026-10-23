import { Extension, Node, mergeAttributes, type Editor, type Range } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import Typography from '@tiptap/extension-typography'
import CharacterCount from '@tiptap/extension-character-count'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { createLowlight, common } from 'lowlight'
import { filterCommands, useSlash, type SlashCommand } from './slash'

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (tone?: CalloutTone) => ReturnType
      toggleCallout: (tone?: CalloutTone) => ReturnType
    }
  }
}

/** A highlighted box that holds any blocks: notes, tips, warnings. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      tone: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-tone') ?? 'info',
        renderHTML: (a) => ({ 'data-tone': a.tone }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]
  },
  addCommands() {
    return {
      setCallout:
        (tone = 'info') =>
        ({ commands }) =>
          commands.wrapIn(this.name, { tone }),
      toggleCallout:
        (tone = 'info') =>
        ({ editor, commands }) =>
          editor.isActive(this.name) ? commands.lift(this.name) : commands.wrapIn(this.name, { tone }),
    }
  },
})

/** "/" opens a menu of blocks to insert; the menu itself is React (see SlashMenu). */
const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterCommands(query),
        command: ({ editor, range, props }) => props.run(editor as Editor, range as Range),
        render: () => ({
          onStart: (p: SuggestionProps<SlashCommand>) => useSlash.getState().show(p),
          onUpdate: (p: SuggestionProps<SlashCommand>) => useSlash.getState().show(p),
          onKeyDown: ({ event }: SuggestionKeyDownProps) => useSlash.getState().key(event),
          onExit: () => useSlash.getState().hide(),
        }),
      }),
    ]
  },
})

const lowlight = createLowlight(common)

/** Everything the full doc editor supports. */
export function docExtensions(placeholder: string) {
  return [
    StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3] } }),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'heading' ? `Heading ${node.attrs.level}` : placeholder),
      includeChildren: false,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Underline,
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ allowBase64: true, HTMLAttributes: { class: 'doc-image' } }),
    Typography,
    CharacterCount,
    TextStyle,
    Color,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }),
    Callout,
    SlashCommands,
  ]
}

export const CODE_LANGUAGES = ['plaintext', 'javascript', 'typescript', 'go', 'python', 'json', 'bash', 'sql', 'css', 'xml', 'yaml', 'markdown', 'java', 'rust']
