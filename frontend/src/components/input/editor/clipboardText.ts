import {Extension} from '@tiptap/core'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import type {Fragment, Node as PMNode, Slice} from '@tiptap/pm/model'

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

function leafText(leaf: PMNode): string {
	const fromSpec = leaf.type.spec.leafText?.(leaf)
	if (typeof fromSpec === 'string') {
		return fromSpec
	}
	return leaf.type.name === 'hardBreak' ? '\n' : ''
}

function textblockText(node: PMNode): string {
	return node.textBetween(0, node.content.size, '\n', leafText)
}

function indent(text: string, prefix: string): string {
	const pad = ' '.repeat(prefix.length)
	return text
		.split('\n')
		.map((line, i) => (i === 0 ? prefix : pad) + line)
		.join('\n')
}

function serializeList(list: PMNode): string {
	const start = typeof list.attrs.start === 'number' ? list.attrs.start : 1
	const items: string[] = []
	list.forEach((item, _offset, index) => {
		let marker = '- '
		if (list.type.name === 'orderedList') {
			marker = `${start + index}. `
		} else if (list.type.name === 'taskList') {
			marker = item.attrs.checked ? '- [x] ' : '- [ ] '
		}
		items.push(indent(serializeBlocks(item.content).join('\n'), marker))
	})
	return items.join('\n')
}

function serializeNode(node: PMNode): string {
	if (LIST_TYPES.has(node.type.name)) {
		return serializeList(node)
	}
	if (node.isTextblock) {
		return textblockText(node)
	}
	if (node.isLeaf) {
		return leafText(node)
	}
	return serializeBlocks(node.content).join('\n\n')
}

function serializeBlocks(fragment: Fragment): string[] {
	const blocks: string[] = []
	let inline = ''
	fragment.forEach(child => {
		if (child.isInline) {
			inline += child.isText ? child.text : leafText(child)
			return
		}
		if (inline !== '') {
			blocks.push(inline)
			inline = ''
		}
		blocks.push(serializeNode(child))
	})
	if (inline !== '') {
		blocks.push(inline)
	}
	return blocks
}

/**
 * Plain text for the clipboard which keeps the structure of lists, so copied
 * bullet, numbered and task lists still read as lists when pasted as text.
 */
export function serializeSliceAsText(slice: Slice): string {
	return serializeBlocks(slice.content).join('\n\n')
}

export const ClipboardPlainText = Extension.create({
	name: 'clipboardPlainText',
	// Ahead of tiptap's core clipboard text serializer, ProseMirror uses the first one it finds.
	priority: 1000,

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('clipboardPlainText'),
				props: {
					clipboardTextSerializer: slice => serializeSliceAsText(slice),
				},
			}),
		]
	},
})
