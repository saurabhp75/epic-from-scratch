import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { db } from '~/utils/db.server'
import { invariantResponse } from '~/utils/misc'

export async function loader({ params }: LoaderFunctionArgs) {
	const { noteId } = params
	const note = db.note.findFirst({
		where: {
			id: { equals: noteId },
		},
	})

	invariantResponse(note, 'note not found', { status: 404 })

	return json({
		note: { title: note.title, content: note.content },
	})
}

export default function SomeNoteId() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="absolute inset-0 flex flex-col px-10">
			<h2 className="mb-2 pt-12 text-h2 lg:mb-6">{data.note?.title}</h2>
			<div className="overflow-y-auto pb-24">
				<p className="whitespace-break-spaces text-sm md:text-lg">
					{data.note?.content}
				</p>
			</div>
		</div>
	)
}
