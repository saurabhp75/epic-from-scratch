import { useParams } from '@remix-run/react'

export default function SomeNoteId() {
	const params = useParams()
	return (
		<div className="absolute inset-0 flex flex-col px-10">
			<h2 className="mb-2 pt-12 text-h2 lg:mb-6">
				{params.noteId} (🐨 replace this with the title)
			</h2>
			<div className="overflow-y-auto pb-24">
				<p className="whitespace-break-spaces text-sm md:text-lg">
					🐨 Note content goes here...
				</p>
			</div>
		</div>
	)
}
